from flask import Blueprint, jsonify, request
from flask_cors import CORS
from src.services.streamService import stream_service
from src.utils.logger import logger

stream_bp = Blueprint('stream', __name__)

# CORS für Stream Blueprint
CORS(stream_bp, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

@stream_bp.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response, 200

@stream_bp.route('/<printer_id>/reset', methods=['POST'])
def reset_stream(printer_id):
    try:
        logger.info(f"\n=== Stream reset requested for printer {printer_id} ===")
        
        if printer_id not in stream_service.active_streams:
            logger.error(f"Printer {printer_id} not found in active streams")
            return jsonify({
                'success': False,
                'error': 'Printer not found'
            }), 404
            
        logger.info("Calling stream service restart_stream...")
        result = stream_service.restart_stream(printer_id)
        logger.info(f"Stream service result: {result}")
        
        if isinstance(result, dict) and 'new_port' in result:
            logger.info(f"Sending new port {result['new_port']} to frontend")
            return jsonify(result)
            
        logger.error("Stream reset failed - no valid result")
        return jsonify({
            'success': False,
            'error': 'Reset failed'
        }), 400
            
    except Exception as e:
        logger.error(f"Error during stream reset: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500 