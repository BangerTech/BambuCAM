from flask import Flask, jsonify, request
from flask_cors import CORS
from src.services import (
    scanNetwork,
    startStream,
    addPrinter,
    getPrinters,
    getPrinterById,
    removePrinter,
    stream_service
)
from src.routes.system import system_bp
from src.routes.notifications import notifications_bp
from src.routes.stream import stream_bp
from src.routes.printers import printers_bp
from src.routes.cloud import cloud_bp
from src.godmode.routes import godmode_bp
import logging  # Standard Python logging
from src.routes import register_blueprints
import os
from pathlib import Path

# Logging-Konfiguration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Stelle sicher, dass auch die requests-Bibliothek Debug-Logs ausgibt
logging.getLogger('urllib3').setLevel(logging.DEBUG)

logger = logging.getLogger(__name__)

app = Flask(__name__)
logger.info("Starting Flask application...")

# Definiere Basis-Verzeichnis
BASE_DIR = Path(os.path.dirname(os.path.dirname(__file__)))
DATA_DIR = BASE_DIR / 'data'
PRINTERS_DIR = DATA_DIR / 'printers'
STREAMS_DIR = DATA_DIR / 'streams'

# CORS mit erweiterten Optionen konfigurieren
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    },
    r"/stream/*": {"origins": "*"}
})

# Stelle sicher, dass die Verzeichnisse existieren
os.makedirs(PRINTERS_DIR, exist_ok=True)
os.makedirs(STREAMS_DIR, exist_ok=True)

# Blueprints nur EINMAL registrieren
register_blueprints(app)

@app.before_request
def log_request_info():
    if request.path.startswith('/api/'):  # Nur API-Anfragen loggen
        logger.info(f"API Request: {request.method} {request.url}")

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

@app.route('/debug/routes')
def list_routes():
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'path': str(rule)
        })
    return jsonify(routes)

@app.route('/api/test', methods=['GET'])
def test_route():
    return jsonify({
        'status': 'ok',
        'message': 'Backend is running'
    })

@app.route('/api/stream/<printer_id>', methods=['GET'])
def start_stream(printer_id):
    """Startet einen neuen Stream"""
    try:
        url = request.args.get('url')
        if not url:
            return jsonify({'error': 'No stream URL provided'}), 400
            
        # Starte den Stream
        result = stream_service.start_stream(printer_id, url)
        
        if result.get('success'):
            return jsonify(result)
        else:
            return jsonify({'error': result.get('error', 'Unknown error')}), 500
            
    except Exception as e:
        logger.error(f"Error starting stream: {e}")
        return jsonify({'error': str(e)}), 500

def register_blueprints(app):
    """Registriert alle Blueprints"""
    app.register_blueprint(cloud_bp, url_prefix='')
    app.register_blueprint(system_bp, url_prefix='/api/system')    
    app.register_blueprint(notifications_bp)
    app.register_blueprint(stream_bp)
    app.register_blueprint(printers_bp)
    app.register_blueprint(godmode_bp)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True) 