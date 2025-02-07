from flask import Flask, jsonify, request
from flask_cors import CORS
from src.services import scanNetwork, getPrinterStatus, startStream, addPrinter, getPrinters, removePrinter, stopStream
from src.services.bambuCloudService import BambuCloudService
from src.services.telegramService import telegram_service
import os
import logging
import psutil  # Sollte bereits in requirements.txt sein

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)

# Erlaube CORS für alle Ursprünge (einfachste Lösung)
CORS(app, 
     resources={r"/*": {
         "origins": "*",  # Erlaubt alle Ursprünge
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization", "Accept"],
         "expose_headers": ["Content-Type"],
         "supports_credentials": True,
         "max_age": 600
     }})

cloud_service = BambuCloudService()

logger = logging.getLogger(__name__)

@app.route('/printers', methods=['GET'])
def get_printers():
    try:
        printers = getPrinters()
        return jsonify(printers)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/scan', methods=['GET'])
def scan_network():
    try:
        printers = scanNetwork()
        return jsonify({
            "status": "success",
            "printers": printers
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/stream/<printer_id>', methods=['GET'])
def start_stream(printer_id):
    try:
        port = startStream(printer_id)
        return jsonify({
            "status": "success",
            "wsPort": port
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/printers/<printer_id>/status', methods=['GET'])
def get_printer_status(printer_id):
    try:
        status = getPrinterStatus(printer_id)  # Verwende die echte Funktion
        return jsonify(status), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/printers', methods=['POST'])
def add_printer():
    try:
        printer_data = request.get_json()
        result = addPrinter(printer_data)
        
        if not result.get('success'):
            return jsonify({
                'error': result.get('error', 'Failed to add printer')
            }), 400
            
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/printers/<printer_id>', methods=['DELETE', 'OPTIONS'])
def delete_printer(printer_id):
    # Handle OPTIONS request für CORS preflight
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response

    try:
        success = removePrinter(printer_id)
        if success:
            return jsonify({"message": f"Printer {printer_id} removed"}), 200
        else:
            return jsonify({"error": "Printer not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/cloud/login', methods=['POST', 'OPTIONS'])
def cloud_login():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        logger.info(f"Login attempt for email: {data.get('email')}")
        
        result = cloud_service.login(
            email=data.get('email'),
            password=data.get('password'),
            verification_code=data.get('verification_code')
        )
        logger.info(f"Login result: {result}")
        
        if result.get('success'):
            return jsonify(result), 200
            
        if result.get('needs_verification'):
            # 2FA wird benötigt - kein Fehler, sondern erwartetes Verhalten
            return jsonify(result), 200  # Ändern von 401 auf 200
            
        logger.error(f"Login failed with error: {result.get('error')}")
        return jsonify(result), 401
        
    except Exception as e:
        logger.error(f"Login exception: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/cloud/printers', methods=['GET'])
def cloud_printers():
    try:
        printers = cloud_service.get_cloud_printers()
        return jsonify(printers)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/debug/stream/<printer_id>', methods=['GET'])
def debug_stream(printer_id):
    """Debug-Endpunkt für Stream-Informationen"""
    try:
        printer = getPrinterById(printer_id)
        if not printer:
            return jsonify({"error": "Printer not found"}), 404
            
        # Teste RTSP-Verbindung
        stream_url = printer['streamUrl']
        result = {
            "printer_id": printer_id,
            "stream_url": stream_url,
            "ffmpeg_running": False,
            "port": None
        }
        
        if printer_id in active_streams:
            stream_info = active_streams[printer_id]
            result["ffmpeg_running"] = stream_info['process'].poll() is None
            result["port"] = stream_info['port']
            
            if result["ffmpeg_running"]:
                # Hole FFmpeg Output
                _, stderr = stream_info['process'].communicate(timeout=0.1)
                result["ffmpeg_output"] = stderr
                
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/stream/<printer_id>/stop', methods=['POST'])
def stop_stream_endpoint(printer_id):
    """Stoppt einen laufenden Stream"""
    try:
        stopStream(printer_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notifications/telegram/setup', methods=['POST'])
def setup_telegram():
    try:
        data = request.json
        token = data.get('token')
        if not token:
            return jsonify({'error': 'No token provided'}), 400
            
        os.environ['TELEGRAM_BOT_TOKEN'] = token
        if not telegram_service.init_bot():
            return jsonify({'error': 'Failed to initialize bot'}), 500
        
        # Bot-Info zurückgeben
        bot_info = telegram_service.bot.bot.get_me()
        return jsonify({
            'message': 'Telegram bot initialized',
            'botUsername': bot_info.username
        })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notifications/send', methods=['POST'])
def send_notification():
    try:
        data = request.json
        message = data.get('message')
        if not message:
            return jsonify({'error': 'No message provided'}), 400
            
        if telegram_service.send_notification(message):
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to send Telegram message'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notifications/test', methods=['POST'])
def send_test_notification():
    try:
        message = (
            "🎉 *Telegram-Benachrichtigungen erfolgreich eingerichtet!*\n\n"
            "Sie erhalten ab jetzt Benachrichtigungen über:\n"
            "✅ Abgeschlossene Drucke\n"
            "❌ Fehlgeschlagene Drucke\n"
            "⚠️ Drucker-Fehler\n\n"
            "Die Benachrichtigungen enthalten:\n"
            "- Drucker-Name\n"
            "- Dateiname\n"
            "- Druckzeit\n"
            "- Fortschritt\n"
            "- Temperaturen\n"
            "- Fehlerdetails (falls vorhanden)\n\n"
            "_Dies ist eine Testnachricht._"
        )
        
        if telegram_service.send_notification(message):
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to send test message'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/system/stats', methods=['GET'])
def get_system_stats():
    try:
        # CPU Statistiken
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        
        # RAM Statistiken
        memory = psutil.virtual_memory()
        ram_total = memory.total / (1024 * 1024 * 1024)  # In GB
        ram_used = memory.used / (1024 * 1024 * 1024)    # In GB
        ram_percent = memory.percent
        
        # Disk Statistiken
        disk = psutil.disk_usage('/')
        disk_total = disk.total / (1024 * 1024 * 1024)   # In GB
        disk_used = disk.used / (1024 * 1024 * 1024)     # In GB
        disk_percent = disk.percent

        return jsonify({
            'cpu': {
                'percent': cpu_percent,
                'cores': cpu_count
            },
            'memory': {
                'total': round(ram_total, 2),
                'used': round(ram_used, 2),
                'percent': ram_percent
            },
            'disk': {
                'total': round(disk_total, 2),
                'used': round(disk_used, 2),
                'percent': disk_percent
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True) 