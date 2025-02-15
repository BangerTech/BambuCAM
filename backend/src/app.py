from flask import Flask, jsonify, request
from flask_cors import CORS
from src.services import scanNetwork, getPrinterStatus, startStream, addPrinter, getPrinters, removePrinter
from src.routes.system import system_bp
from src.routes.notifications import notifications_bp
from src.routes.stream import stream_bp
from src.utils.logger import logger
from src.services.streamService import stream_service

app = Flask(__name__)
logger.info("Starting Flask application...")

# Einfachste CORS-Konfiguration
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Blueprints registrieren
app.register_blueprint(system_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(stream_bp, url_prefix='/stream')

# Globaler CORS Handler für OPTIONS requests
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response, 200

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

@app.route('/stream/<printer_id>/stop', methods=['POST'])
def stop_stream(printer_id):
    """Stoppt einen laufenden Stream"""
    try:
        stream_service.stop_stream(printer_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Füge diese Route auch hinzu
@app.errorhandler(404)
def not_found(e):
    """Handler für 404 Fehler - gibt JSON statt HTML zurück"""
    return jsonify({
        'success': False,
        'error': 'Route not found'
    }), 404

# ... andere Routes ... 

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000) 