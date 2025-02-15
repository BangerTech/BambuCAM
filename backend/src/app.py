from flask import Flask, jsonify, request
from flask_cors import CORS
from src.services import scanNetwork, getPrinterStatus, startStream, addPrinter, getPrinters, removePrinter
from src.routes.system import system_bp
from src.routes.notifications import notifications_bp
from src.routes.stream import stream_bp
from src.routes.printers import printers_bp
from src.utils.logger import logger
from src.services.streamService import stream_service
from src.routes import register_blueprints

app = Flask(__name__)
logger.info("Starting Flask application...")

# CORS mit erweiterten Optionen konfigurieren
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Blueprints registrieren
register_blueprints(app)

@app.route('/stream/<printer_id>/stop', methods=['POST'])
def stop_stream(printer_id):
    """Stoppt einen laufenden Stream"""
    try:
        stream_service.stop_stream(printer_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found(e):
    """Handler für 404 Fehler - gibt JSON statt HTML zurück"""
    return jsonify({
        'success': False,
        'error': 'Route not found'
    }), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True)  # debug=True aktiviert Auto-Reload 