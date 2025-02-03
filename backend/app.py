from flask import Flask, jsonify, request
from flask_cors import CORS
from src.services import scanNetwork, getPrinterStatus, startStream, addPrinter, getPrinters, removePrinter
import os

app = Flask(__name__)

# Konfiguriere CORS korrekt
CORS(app, 
     resources={r"/*": {
         "origins": ["http://localhost:3000", "http://192.168.188.114:3000"],  # Erlaube Frontend Origins
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization", "Accept"],
         "expose_headers": ["Content-Type"],
         "supports_credentials": True,
         "max_age": 600
     }})

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
        # Mock-Status für den Test
        status = {
            "temperatures": {
                "bed": 60.0,
                "nozzle": 200.0
            },
            "printTime": {
                "remaining": 1800  # 30 Minuten in Sekunden
            },
            "status": "printing",
            "progress": 45  # Prozent
        }
        
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True) 