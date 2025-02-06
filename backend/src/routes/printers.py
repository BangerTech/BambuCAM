from flask import jsonify
from backend.services.streamService import stream_service
from backend.services.mqttService import mqtt_service
from backend.services.printerService import removePrinter
from backend.utils.logger import logger

@printers_bp.route('/printers/<printer_id>', methods=['DELETE'])
def delete_printer(printer_id):
    try:
        # Erst Stream stoppen
        stream_service.stop_stream(printer_id)
        
        # MQTT Verbindung trennen
        mqtt_service.disconnect_printer(printer_id)
        
        # Dann Drucker löschen
        success = removePrinter(printer_id)
        
        if success:
            return jsonify({"message": "Printer removed successfully"}), 200
        return jsonify({"error": "Printer not found"}), 404
        
    except Exception as e:
        logger.error(f"Error deleting printer: {e}")
        return jsonify({"error": str(e)}), 500 