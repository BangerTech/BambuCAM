from flask import Blueprint, jsonify, request
from flask_cors import cross_origin
from src.services.bambuCloudService import bambu_cloud_service
import logging

logger = logging.getLogger(__name__)

cloud_bp = Blueprint('cloud', __name__)

@cloud_bp.route('/cloud/printers', methods=['GET'])
@cross_origin()
def get_cloud_printers():
    try:
        printers = bambu_cloud_service.get_cloud_printers()
        return jsonify(printers)
    except Exception as e:
        logger.error(f"Error fetching cloud printers: {e}")
        return jsonify({'error': str(e)}), 500

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
            
        result = bambu_cloud_service.login(email, password, verification_code)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error during cloud login: {e}")
        return jsonify({'error': str(e)}), 500 