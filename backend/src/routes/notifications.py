from flask import Blueprint, jsonify, request
from flask_cors import cross_origin
import logging
import os
import json
from src.config import Config
import requests
from src.services.telegramService import telegram_service

logger = logging.getLogger(__name__)
notifications_bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')

# BambuCAM ASCII Logo
BAMBUCAM_LOGO = """
╔══════════════════════╗
║     BambuCAM        ║
║    Notification     ║
╚══════════════════════╝
"""

# Definiere die Verzeichnisse
NOTIFICATIONS_DIR = os.path.join(Config.DATA_DIR, 'notifications')
NOTIFICATIONS_FILE = os.path.join(NOTIFICATIONS_DIR, 'notifications.json')

# Stelle sicher, dass das Verzeichnis existiert
os.makedirs(NOTIFICATIONS_DIR, exist_ok=True)

def save_notification_settings(settings):
    """Speichert die Benachrichtigungseinstellungen"""
    try:
        logger.info(f"Attempting to save settings to {NOTIFICATIONS_FILE}")
        logger.info(f"Settings data: {settings}")
        
        # Stelle sicher, dass das Verzeichnis existiert
        if not os.path.exists(NOTIFICATIONS_DIR):
            logger.info(f"Creating directory: {NOTIFICATIONS_DIR}")
            os.makedirs(NOTIFICATIONS_DIR, exist_ok=True)
        
        # Speichere die Einstellungen
        with open(NOTIFICATIONS_FILE, 'w') as f:
            json.dump(settings, f, indent=2)
            
        logger.info(f"Successfully saved settings to {NOTIFICATIONS_FILE}")
    except Exception as e:
        logger.error(f"Error saving notification settings: {e}", exc_info=True)
        raise

@notifications_bp.route('/status', methods=['GET'])
def get_notification_status():
    """Gibt den aktuellen Status der Benachrichtigungsdienste zurück"""
    try:
        if os.path.exists(NOTIFICATIONS_FILE):
            with open(NOTIFICATIONS_FILE, 'r') as f:
                settings = json.load(f)
                return jsonify(settings)
        return jsonify({})
    except Exception as e:
        logger.error(f"Error getting notification status: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/telegram/setup', methods=['POST'])
def setup_telegram():
    try:
        # Detaillierteres Logging
        logger.info("=== Telegram Setup Debug ===")
        logger.info(f"Request Method: {request.method}")
        logger.info(f"Content-Type: {request.content_type}")
        logger.info(f"Raw Data: {request.get_data()}")
        
        data = request.json
        logger.info(f"Parsed JSON data: {data}")
        
        token = data.get('token')
        logger.info(f"Extracted token: {token}")
        
        if not token:
            logger.error("Bot token is missing in request")
            return jsonify({'error': 'Bot token is required'}), 400

        # Prüfe ob das Verzeichnis existiert
        logger.info(f"Checking directory: {NOTIFICATIONS_DIR}")
        if not os.path.exists(NOTIFICATIONS_DIR):
            logger.info("Creating notifications directory")
            os.makedirs(NOTIFICATIONS_DIR, exist_ok=True)
            
        # Teste den Bot Token
        test_url = f"https://api.telegram.org/bot{token}/getMe"
        logger.info(f"Testing bot token at URL: {test_url}")
        response = requests.get(test_url)
        
        if not response.ok:
            logger.error(f"Invalid bot token. Response: {response.text}")
            return jsonify({'error': 'Invalid bot token'}), 400
            
        bot_data = response.json()
        bot_username = bot_data['result']['username']
        logger.info(f"Bot username: {bot_username}")
            
        # Hole die vorhandene chat_id aus der alten Konfiguration wenn vorhanden
        existing_chat_ids = []
        if os.path.exists(NOTIFICATIONS_FILE):
            with open(NOTIFICATIONS_FILE, 'r') as f:
                old_settings = json.load(f)
                existing_chat_ids = old_settings.get('telegram', {}).get('chat_ids', [])
        
        # Speichere die Einstellungen
        settings = {
            'telegram': {
                'enabled': True,
                'token': token,
                'chat_ids': existing_chat_ids,
                'bot_username': bot_username
            }
        }
        
        save_notification_settings(settings)
        
        # Wichtig: Bot mit neuem Token initialisieren
        telegram_service.initialize_bot(token)
        
        return jsonify({
            'success': True,
            'botUsername': bot_username
        })
        
    except Exception as e:
        logger.error(f"Error setting up Telegram: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/telegram/status', methods=['GET'])
@cross_origin()
def get_telegram_status():
    try:
        if os.path.exists(NOTIFICATIONS_FILE):
            with open(NOTIFICATIONS_FILE, 'r') as f:
                settings = json.load(f)
                return jsonify({
                    'enabled': settings.get('telegram', {}).get('enabled', False),
                    'configured': bool(settings.get('telegram', {}).get('token'))
                })
        return jsonify({'enabled': False, 'configured': False})
    except Exception as e:
        logger.error(f"Error getting Telegram status: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/telegram/enable', methods=['POST'])
def enable_telegram():
    try:
        if os.path.exists(NOTIFICATIONS_FILE):
            with open(NOTIFICATIONS_FILE, 'r') as f:
                settings = json.load(f)
                
            settings['telegram']['enabled'] = True
            save_notification_settings(settings)
            
            # Sende Benachrichtigung
            telegram_service.send_status_notification(True)
            
            return jsonify({
                'success': True,
                'message': 'Telegram notifications enabled'
            })
        return jsonify({'error': 'Telegram not configured'}), 400
    except Exception as e:
        logger.error(f"Error enabling Telegram: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/telegram/disable', methods=['POST'])
def disable_telegram():
    try:
        if os.path.exists(NOTIFICATIONS_FILE):
            with open(NOTIFICATIONS_FILE, 'r') as f:
                settings = json.load(f)
                
            settings['telegram']['enabled'] = False
            save_notification_settings(settings)
            
            # Sende Benachrichtigung
            telegram_service.send_status_notification(False)
            
            return jsonify({
                'success': True,
                'message': 'Telegram notifications disabled'
            })
        return jsonify({'error': 'Telegram not configured'}), 400
    except Exception as e:
        logger.error(f"Error disabling Telegram: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/telegram/reset', methods=['POST'])
def reset_telegram():
    """Löscht die Telegram-Konfiguration"""
    try:
        if os.path.exists(NOTIFICATIONS_FILE):
            os.remove(NOTIFICATIONS_FILE)
            logger.info("Telegram configuration reset")
            return jsonify({
                'success': True,
                'message': 'Telegram configuration reset successfully'
            })
        return jsonify({
            'success': True,
            'message': 'No configuration to reset'
        })
    except Exception as e:
        logger.error(f"Error resetting Telegram configuration: {e}", exc_info=True)
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