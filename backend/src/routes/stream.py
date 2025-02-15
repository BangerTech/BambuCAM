from flask import Blueprint, jsonify, request, Response
from src.services.streamService import stream_service
import logging
import requests

# Einfacher Logger statt des spezialisierten Loggers
logger = logging.getLogger(__name__)

stream_bp = Blueprint('stream', __name__)

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

@stream_bp.route('/stream/mjpeg/<printer_id>')
def proxy_mjpeg_stream(printer_id):
    try:
        # Lade Drucker-Daten
        printer = getPrinterById(printer_id)
        if not printer:
            return jsonify({'error': 'Printer not found'}), 404
            
        # Stream-URL für Creality
        stream_url = f"http://{printer['ip']}:8080/?action=stream"
        
        def generate():
            try:
                response = requests.get(stream_url, stream=True)
                if response.ok:
                    for chunk in response.iter_content(chunk_size=8192):
                        yield chunk
            except Exception as e:
                logger.error(f"Error proxying MJPEG stream: {e}")
                
        return Response(
            generate(),
            mimetype='multipart/x-mixed-replace;boundary=boundarydonotcross',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0',
                'Pragma': 'no-cache'
            }
        )
        
    except Exception as e:
        logger.error(f"Error setting up MJPEG proxy: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500 