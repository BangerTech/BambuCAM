from flask import Blueprint, jsonify
from flask_cors import cross_origin
import logging
import os

logger = logging.getLogger(__name__)
notifications_bp = Blueprint('notifications', __name__)

# BambuCAM ASCII Logo
BAMBUCAM_LOGO = """
╔══════════════════════╗
║     BambuCAM        ║
║    Notification     ║
╚══════════════════════╝
"""

@notifications_bp.route('/status', methods=['GET'])
@cross_origin()
def get_notification_status():
    try:
        return jsonify({
            'telegram': True,
            'whatsapp': False
        })
    except Exception as e:
        logger.error(f"Error getting notification status: {e}")
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/telegram/status', methods=['GET'])
@cross_origin()
def get_telegram_status():
    try:
        # Prüfe ob Telegram konfiguriert ist
        telegram_token = os.getenv('TELEGRAM_TOKEN')
        telegram_chat_id = os.getenv('TELEGRAM_CHAT_ID')
        
        return jsonify({
            'configured': bool(telegram_token and telegram_chat_id),
            'token': bool(telegram_token),
            'chat_id': bool(telegram_chat_id)
        })
    except Exception as e:
        logger.error(f"Error getting telegram status: {e}")
        return jsonify({'error': str(e)}), 500

# @notifications_bp.route('/notifications/whatsapp/login', methods=['POST'])
# @cross_origin()
# def login_whatsapp():
#     """Öffnet WhatsApp Web zum Login"""
#     try:
#         # Öffne WhatsApp Web
#         webbrowser.open('https://web.whatsapp.com')
#         
#         # Warte 30 Sekunden für QR-Code Scan
#         time.sleep(30)
#         
#         global is_whatsapp_logged_in
#         is_whatsapp_logged_in = True
#         
#         return jsonify({"success": True, "message": "Please scan QR code in browser"})
#     except Exception as e:
#         logger.error(f"Error during WhatsApp login: {e}")
#         return jsonify({"error": str(e)}), 500

# @notifications_bp.route('/notifications/whatsapp', methods=['POST', 'OPTIONS'])
# def set_whatsapp():
#     """Speichert die WhatsApp Nummer"""
#     try:
#         data = request.json
#         whatsapp_number = data.get('number')
#         
#         if not is_whatsapp_logged_in:
#             return jsonify({
#                 "error": "WhatsApp Web not logged in",
#                 "needs_login": True
#             }), 401
#             
#         return jsonify({"success": True, "number": whatsapp_number})
#
#     except Exception as e:
#         logger.error(f"Error setting WhatsApp number: {e}")
#         return jsonify({"error": str(e)}), 500

# @notifications_bp.route('/notifications/whatsapp/send', methods=['POST'])
# @cross_origin()
# def send_whatsapp():
#     """Sendet eine WhatsApp Nachricht mit formatiertem Text"""
#     ... 