from flask import jsonify
from backend.services.streamService import StreamService

stream_service = StreamService()

@printers_bp.route('/printers/<printer_id>', methods=['DELETE'])
def delete_printer(printer_id):
    try:
        # Erst Stream stoppen
        stream_service.stop_stream(printer_id)
        
        # Dann Drucker löschen
        # ... existing delete code ...
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500 