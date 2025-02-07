from flask import Blueprint, jsonify, request
from flask_cors import cross_origin
import pywhatkit
import logging
import datetime
import webbrowser
import time

logger = logging.getLogger(__name__)
notifications_bp = Blueprint('notifications', __name__)

# BambuCAM ASCII Logo
BAMBUCAM_LOGO = """
╔══════════════════════╗
║     BambuCAM        ║
║    Notification     ║
╚══════════════════════╝
"""

# Globale Variablen
whatsapp_number = None
is_whatsapp_logged_in = False

@notifications_bp.route('/notifications/whatsapp/login', methods=['POST'])
@cross_origin()
def login_whatsapp():
    """Öffnet WhatsApp Web zum Login"""
    try:
        # Öffne WhatsApp Web
        webbrowser.open('https://web.whatsapp.com')
        
        # Warte 30 Sekunden für QR-Code Scan
        time.sleep(30)
        
        global is_whatsapp_logged_in
        is_whatsapp_logged_in = True
        
        return jsonify({"success": True, "message": "Please scan QR code in browser"})
    except Exception as e:
        logger.error(f"Error during WhatsApp login: {e}")
        return jsonify({"error": str(e)}), 500

@notifications_bp.route('/notifications/whatsapp', methods=['POST', 'OPTIONS'])
def set_whatsapp():
    """Speichert die WhatsApp Nummer"""
    try:
        data = request.json
        whatsapp_number = data.get('number')
        
        if not is_whatsapp_logged_in:
            return jsonify({
                "error": "WhatsApp Web not logged in",
                "needs_login": True
            }), 401
            
        return jsonify({"success": True, "number": whatsapp_number})

    except Exception as e:
        logger.error(f"Error setting WhatsApp number: {e}")
        return jsonify({"error": str(e)}), 500

@notifications_bp.route('/notifications/whatsapp/send', methods=['POST'])
@cross_origin()
def send_whatsapp():
    """Sendet eine WhatsApp Nachricht mit formatiertem Text"""
    global whatsapp_number
    try:
        if not whatsapp_number:
            return jsonify({"error": "No WhatsApp number configured"}), 400

        data = request.json
        printer_name = data.get('printer_name', 'Unknown Printer')
        status = data.get('status', 'unknown')
        
        # Formatierte Nachricht mit Logo
        message = f"{BAMBUCAM_LOGO}\n"
        message += f"🖨️ Printer: {printer_name}\n"
        
        # Status-spezifische Emojis und Nachrichten
        if status.lower() == 'completed':
            message += "✅ Print completed successfully!\n"
        elif status.lower() == 'error':
            message += "❌ Print failed! Please check the printer.\n"
        elif status.lower() == 'cancelled':
            message += "⚠️ Print was cancelled.\n"
        
        message += f"\nTime: {datetime.datetime.now().strftime('%H:%M:%S')}"
        
        # Aktuelle Zeit + 2 Minuten
        now = datetime.datetime.now()
        send_time = now + datetime.timedelta(minutes=2)
        
        # Sende Nachricht mit Logo
        pywhatkit.sendwhatmsg(
            whatsapp_number,
            message,
            send_time.hour,
            send_time.minute,
            15,  # Wartezeit
            True,  # Schließe Tab
            2  # Schließe nach 2 Sekunden
        )
        
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error sending WhatsApp message: {e}")
        return jsonify({"error": str(e)}), 500 