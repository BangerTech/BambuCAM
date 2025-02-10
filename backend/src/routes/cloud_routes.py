from flask import jsonify
from flask_restful import Resource
from flask_restful.reqparse import RequestParser
from flask_restful import Api
from flask_restful import Resource
from flask_restful.reqparse import RequestParser
from flask_restful import Api

@cloud_bp.route('/api/cloud/printers', methods=['GET'])
def get_cloud_printers():
    try:
        response = bambu_cloud_service.get_printers()
        logger.debug(f"Raw cloud response: {response}")
        
        if response.get('message') == 'success' and response.get('devices'):
            # Direkt die Geräte zurückgeben
            return jsonify(response['devices'])
            
        return jsonify([])  # Leeres Array wenn keine Drucker
        
    except Exception as e:
        logger.error(f"Error fetching cloud printers: {e}")
        return jsonify({'error': str(e)}), 500 