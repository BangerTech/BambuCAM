from flask import Blueprint, jsonify, request, Response
from src.services.streamService import stream_service
from src.services.printerService import getPrinterById
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

@stream_bp.route('/mjpeg/<printer_id>')
def proxy_mjpeg_stream(printer_id):
    try:
        printer = getPrinterById(printer_id)
        if not printer:
            logger.error(f"Printer {printer_id} not found")
            return jsonify({'error': 'Printer not found'}), 404
            
        stream_url = f"http://{printer['ip']}:8080/?action=stream"
        logger.info(f"Proxying stream from: {stream_url}")
        
        def generate():
            try:
                response = requests.get(stream_url, stream=True, timeout=5)
                if response.ok:
                    headers = response.headers
                    logger.debug(f"Original headers: {headers}")
                    for chunk in response.iter_content(chunk_size=8192):
                        yield chunk
            except Exception as e:
                logger.error(f"Error proxying MJPEG stream: {e}")
                
        return Response(
            generate(),
            mimetype='multipart/x-mixed-replace; boundary=boundarydonotcross',
            direct_passthrough=True,  # Wichtig für Streaming
            headers={
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Connection': 'close',
            }
        )
    except Exception as e:
        logger.error(f"Error setting up MJPEG proxy: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500 