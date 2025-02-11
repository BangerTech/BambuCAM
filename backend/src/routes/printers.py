from flask import jsonify
from backend.services.streamService import stream_service
from backend.services.mqttService import mqtt_service
from backend.services.printerService import removePrinter
from backend.utils.logger import logger
import uuid

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

def addPrinter(data):
    """Fügt einen neuen Drucker hinzu"""
    try:
        printer_id = str(uuid.uuid4())
        printer = {
            'id': printer_id,
            'name': data.get('name', 'Unnamed Printer'),
            'ip': data.get('ip'),
            'type': data.get('type', 'LAN'),  # Default ist LAN, kann auch CLOUD sein
            'status': 'offline',
            'temperatures': {
                'nozzle': 0,
                'bed': 0,
                'chamber': 0
            },
            'progress': 0,
            'remaining_time': 0
        }
        
        stored_printers[printer_id] = printer
        savePrinters()  # Speichere Drucker in JSON
        
        # Starte MQTT Client für LAN Drucker
        if printer['type'] == 'LAN':
            printer_service.connect_mqtt(printer_id, printer['ip'])
        # Für Cloud-Drucker andere Verbindungsmethode...
        
        return printer
        
    except Exception as e:
        logger.error(f"Error adding printer: {e}")
        raise 

@app.route('/printers', methods=['POST'])
def add_printer():
    try:
        data = request.get_json()
        logger.debug(f"Adding printer with data: {data}")
        logger.debug(f"Printer type: {data.get('type')} (type: {type(data.get('type'))})")
        
        # Basisfelder die immer benötigt werden
        required_fields = ['name', 'type']
        
        printer_type = data.get('type', '').upper()
        logger.debug(f"Normalized printer type: {printer_type}")
        
        # Zusätzliche Felder je nach Typ
        if printer_type == 'CLOUD':
            required_fields.extend(['cloudId', 'accessCode'])
            logger.debug("Using CLOUD required fields")
        elif printer_type == 'LAN':
            required_fields.extend(['ip', 'accessCode'])
            logger.debug("Using LAN required fields")
        else:
            error_msg = f"Unsupported printer type: {printer_type}"
            logger.error(error_msg)
            return jsonify({
                'success': False,
                'error': error_msg
            }), 400
            
        # Prüfe alle erforderlichen Felder
        missing_fields = [field for field in required_fields if not data.get(field)]
        logger.debug(f"Required fields: {required_fields}")
        logger.debug(f"Missing fields: {missing_fields}")
        
        if missing_fields:
            error_msg = f"Missing fields: {', '.join(missing_fields)}"
            logger.error(error_msg)
            return jsonify({
                'success': False,
                'error': 'Missing required fields',
                'details': error_msg
            }), 400

        # Erstelle Drucker-Objekt
        printer = {
            'id': str(uuid.uuid4()),
            'name': data['name'],
            'type': printer_type,
            'cloudId': data.get('cloudId'),
            'ip': data.get('ip'),
            'accessCode': data['accessCode'],
            'model': data.get('model', 'X1 Carbon'),
            'status': data.get('status', 'offline'),
            'temperatures': data.get('temperatures', {
                'nozzle': 0,
                'bed': 0,
                'chamber': 0
            }),
            'progress': data.get('progress', 0),
            'remaining_time': data.get('remaining_time', 0)
        }
        
        # Speichere Drucker
        stored_printers[printer['id']] = printer
        savePrinters()  # Speichere in JSON
        
        logger.info(f"Successfully added printer: {printer['name']} ({printer['id']})")
        return jsonify({
            'success': True,
            'printer': printer
        })
            
    except Exception as e:
        logger.error(f"Error adding printer: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400 