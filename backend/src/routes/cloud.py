from flask import Blueprint, jsonify, request
from flask_cors import cross_origin
from src.services.bambuCloudService import bambu_cloud_service
from src.config import Config
import json
import os
import logging

logger = logging.getLogger(__name__)

cloud_bp = Blueprint('cloud', __name__)

@cloud_bp.route('/cloud/login', methods=['POST'])
@cross_origin()
def cloud_login():
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

@cloud_bp.route('/cloud/printers', methods=['GET'])
@cross_origin()
def get_cloud_printers():
    try:
        printers = bambu_cloud_service.get_cloud_printers()
        return jsonify(printers)
    except Exception as e:
        logger.error(f"Error fetching cloud printers: {e}")
        return jsonify({'error': str(e)}), 500

@cloud_bp.route('/cloud/status', methods=['GET'])
def get_cloud_status():
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