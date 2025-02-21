from flask import Blueprint, jsonify, request
from flask_cors import cross_origin
from src.services.bambuCloudService import bambu_cloud_service
from src.config import Config
import json
import os
import logging

logger = logging.getLogger(__name__)

cloud_bp = Blueprint('cloud', __name__)

@cloud_bp.route('/api/cloud/login', methods=['POST', 'OPTIONS'])
@cross_origin()
def cloud_login():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        verification_code = data.get('verification_code')
        
        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400
            
        # 1. Login zur Cloud API
        result = bambu_cloud_service.login(email, password, verification_code)
        
        if result.get('success'):
            # 2. Speichere erfolgreiche Zugangsdaten
            cloud_config = {
                'email': email,
                'password': password,
                'connected': True
            }
            
            os.makedirs(Config.BAMBU_CLOUD_DIR, exist_ok=True)
            with open(Config.BAMBU_CLOUD_FILE, 'w') as f:
                json.dump(cloud_config, f, indent=2)
                logger.info(f"Saved Bambu Cloud config to {Config.BAMBU_CLOUD_FILE}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error during cloud login: {e}")
        return jsonify({'error': str(e)}), 500

@cloud_bp.route('/api/cloud/printers', methods=['GET', 'OPTIONS'])
@cross_origin()
def get_cloud_printers():
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        printers = bambu_cloud_service.get_cloud_printers()
        return jsonify(printers)
    except Exception as e:
        logger.error(f"Error fetching cloud printers: {e}")
        return jsonify({'error': str(e)}), 500

@cloud_bp.route('/api/cloud/status', methods=['GET', 'OPTIONS'])
@cross_origin()
def get_cloud_status():
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        if os.path.exists(Config.BAMBU_CLOUD_FILE):
            with open(Config.BAMBU_CLOUD_FILE, 'r') as f:
                config = json.load(f)
                return jsonify({
                    'connected': config.get('connected', False)
                })
        return jsonify({'connected': False})
    except Exception as e:
        logger.error(f"Error getting cloud status: {e}")
        return jsonify({'error': str(e)}), 500

@cloud_bp.route('/api/cloud/printers/add', methods=['POST'])
@cross_origin()
def add_cloud_printer():
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        data = request.get_json()
        logger.info(f"Adding cloud printer with data: {data}")
        
        # Formatiere die Druckerdaten ins richtige Format
        printer_data = {
            'name': data.get('name'),
            'type': 'CLOUD',
            'ip': None,  # Cloud Drucker haben keine direkte IP
            'cloudId': data.get('cloudId'),
            'accessCode': data.get('accessCode'),
            'model': data.get('model'),
            'status': data.get('status', 'offline'),
            'isCloud': True,
            'temperatures': {
                'hotend': 0,
                'bed': 0,
                'chamber': 0
            },
            'progress': 0,
            'port': 8554
        }
        
        # Überprüfe ob erforderliche Daten vorhanden sind
        if not printer_data['cloudId'] or not printer_data['accessCode']:
            return jsonify({
                'success': False,
                'error': 'Missing required cloud printer data (cloudId or accessCode)'
            }), 400
        
        # Füge den Drucker hinzu
        from src.services.printerService import addPrinter
        new_printer = addPrinter(printer_data)
        
        return jsonify({
            'success': True,
            'printer': new_printer
        })
        
    except Exception as e:
        logger.error(f"Error adding cloud printer: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@cloud_bp.route('/api/cloud/printer/<printer_id>/status', methods=['GET'])
@cross_origin()
def get_cloud_printer_status(printer_id):
    try:
        # Hole den Drucker aus der Datenbank/Config
        from src.services.printerService import getPrinter
        printer = getPrinter(printer_id)
        
        if not printer or not printer.get('cloudId') or not printer.get('accessCode'):
            return jsonify({'error': 'Printer not found or missing cloud data'}), 404
            
        # Hole den Status über die Cloud API
        status = bambu_cloud_service.get_cloud_printer_status(
            printer['cloudId'], 
            printer['accessCode']
        )
        
        if status:
            return jsonify(status)
        return jsonify({'error': 'Could not get printer status'}), 500
            
    except Exception as e:
        logger.error(f"Error getting cloud printer status: {e}")
        return jsonify({'error': str(e)}), 500

@cloud_bp.route('/api/cloud/printer/<printer_id>/stream', methods=['GET'])
@cross_origin()
def get_printer_stream(printer_id):
    try:
        # Hole den Drucker aus der Datenbank/Config
        from src.services.printerService import getPrinter
        printer = getPrinter(printer_id)
        
        if not printer or not printer.get('cloudId') or not printer.get('accessCode'):
            return jsonify({'error': 'Printer not found or missing cloud data'}), 404
            
        # Hole Stream URL über die Cloud API
        stream_data = bambu_cloud_service.get_stream_url(
            printer['cloudId'], 
            printer['accessCode']
        )
        
        if stream_data:
            return jsonify(stream_data)
        return jsonify({'error': 'Could not get stream URL'}), 500
            
    except Exception as e:
        logger.error(f"Error getting printer stream URL: {e}")
        return jsonify({'error': str(e)}), 500 