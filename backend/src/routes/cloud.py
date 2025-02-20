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
        verification_code = data.get('verification_code')
        use_stored = data.get('useStoredCredentials', False)
        
        # Wenn useStoredCredentials true ist, verwende gespeicherte Credentials
        if use_stored:
            if os.path.exists(Config.BAMBU_CLOUD_FILE):
                with open(Config.BAMBU_CLOUD_FILE, 'r') as f:
                    config = json.load(f)
                    password = config.get('password')
                    # Wenn kein Verification Code übergeben wurde, prüfe ob der letzte noch gültig ist
                    if not verification_code:
                        # Versuche Login ohne Code
                        result = bambu_cloud_service.login(email, password)
                        if not result.get('needs_verification'):
                            return jsonify(result)
                        # Wenn Verification benötigt wird, gib das zurück
                        return jsonify({
                            'needs_verification': True,
                            'message': 'Please enter the verification code'
                        })
            else:
                return jsonify({'error': 'No stored credentials found'}), 400
        else:
            if not data.get('password'):
                return jsonify({'error': 'Password required'}), 400
            password = data.get('password')
        
        if not email:
            return jsonify({'error': 'Email required'}), 400
            
        # 1. Login zur Cloud API
        result = bambu_cloud_service.login(email, password, verification_code)
        
        # Wenn der Code abgelaufen ist, automatisch einen neuen anfordern
        if (result.get('error') and 
            'Code does not exist or has expired' in result.get('error')):
            # Neuen Login-Versuch ohne Code um neuen Code anzufordern
            result = bambu_cloud_service.login(email, password)
            if result.get('needs_verification'):
                return jsonify({
                    'needs_verification': True,
                    'message': 'A new verification code has been sent to your email'
                })
        
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

@cloud_bp.route('/api/cloud/check-credentials', methods=['GET'])
def check_credentials():
    """Prüft ob gespeicherte Cloud-Credentials existieren"""
    try:
        config_file = os.path.join(Config.BAMBU_CLOUD_DIR, 'bambu_cloud.json')
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config = json.load(f)
                return jsonify({
                    'hasCredentials': True,
                    'email': config.get('email')
                })
        return jsonify({'hasCredentials': False})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cloud_bp.route('/api/cloud/reset-credentials', methods=['POST'])
@cross_origin()
def reset_credentials():
    """Löscht die gespeicherten Cloud-Credentials"""
    try:
        if os.path.exists(Config.BAMBU_CLOUD_FILE):
            os.remove(Config.BAMBU_CLOUD_FILE)
            return jsonify({'success': True, 'message': 'Credentials successfully reset'})
        return jsonify({'success': True, 'message': 'No credentials found'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500 