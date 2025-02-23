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
import logging  # Standard Python logging
from src.routes import register_blueprints
import os
from pathlib import Path
import yaml
import socket

def get_host_ip():
    """Ermittelt die Host-IP"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '0.0.0.0'

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

# Stelle sicher, dass die Verzeichnisse existieren
os.makedirs(PRINTERS_DIR, exist_ok=True)
os.makedirs(STREAMS_DIR, exist_ok=True)

# Stelle sicher, dass das go2rtc Verzeichnis existiert
GO2RTC_DIR = DATA_DIR / 'go2rtc'
GO2RTC_CONFIG = GO2RTC_DIR / 'go2rtc.yaml'
os.makedirs(GO2RTC_DIR, exist_ok=True)

# Erstelle initiale go2rtc Konfiguration wenn sie nicht existiert
if not os.path.exists(GO2RTC_CONFIG):
    logger.info("Creating initial go2rtc configuration")
    initial_config = {
        'streams': {},
        'api': {
            'listen': '0.0.0.0:1984',
            'base_path': '',  # Korrekt für Web-UI
            'origin': '*'
        },
        'webrtc': {
            'listen': '0.0.0.0:8555',
            'candidates': [f"{get_host_ip()}:8555"]
        }
    }
    with open(GO2RTC_CONFIG, 'w') as f:
        yaml.safe_dump(initial_config, f)
    logger.info(f"Created initial go2rtc config at {GO2RTC_CONFIG}")

# CORS mit erweiterten Optionen konfigurieren
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    },
    r"/stream/*": {"origins": "*"}
})

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

@app.route('/api/debug/go2rtc/config')
def debug_go2rtc_config():
    try:
        with open('/app/data/go2rtc/go2rtc.yaml', 'r') as f:
            config = yaml.safe_load(f)
        return jsonify(config)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True) 