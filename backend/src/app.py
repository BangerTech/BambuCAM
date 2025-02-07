from flask import Flask, jsonify, request
from flask_cors import CORS
from src.services import scanNetwork, getPrinterStatus, startStream, addPrinter, getPrinters, removePrinter
from src.routes.system import system_bp
from src.routes.notifications import notifications_bp
import logging

logger = logging.getLogger(__name__)
app = Flask(__name__)

# Erweiterte CORS-Konfiguration
CORS(app, resources={
    r"/*": {
        "origins": ["http://192.168.2.86:3000", "http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": True,
        "max_age": 600
    }
})

# Blueprints registrieren
app.register_blueprint(system_bp)
app.register_blueprint(notifications_bp)

# Globaler Error Handler für CORS
@app.after_request
def after_request(response):
    # Erlaube nur spezifische Origins
    origin = request.headers.get('Origin')
    if origin in ["http://192.168.2.86:3000", "http://localhost:3000"]:
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/printers/<printer_id>', methods=['DELETE'])
def delete_printer(printer_id):
    try:
        success = removePrinter(printer_id)
        if success:
            return jsonify({"message": f"Printer {printer_id} removed"}), 200
        else:
            return jsonify({"error": "Printer not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ... andere Routes ... 