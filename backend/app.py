from flask import Flask, jsonify, request
from flask_cors import CORS
from src.services import scanNetwork, getPrinterStatus, startStream, addPrinter, getPrinters, removePrinter
from src.services.bambuCloudService import BambuCloudService
import os
import logging

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
        data = request.json
        
        # Validiere Pflichtfelder
        required_fields = ['name', 'ip', 'accessCode']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    "success": False,
                    "error": "Missing required fields",
                    "details": f"Field '{field}' is required"
                }), 400
        
        # Erstelle Stream-URL wenn nicht vorhanden
        if not data.get('streamUrl'):
            data['streamUrl'] = f"rtsps://bblp:{data['accessCode']}@{data['ip']}:322/streaming/live/1"
        
        # WebSocket-Port hinzufügen
        data['wsPort'] = 9000
        
        # Drucker speichern
        printer = addPrinter(data)
        
        return jsonify({
            "success": True,
            "printer": printer
        })
    except Exception as e:
        print(f"Error adding printer: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Connection error",
            "details": str(e)
        }), 400

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True) 