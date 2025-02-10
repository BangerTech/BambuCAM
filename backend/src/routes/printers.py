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
        
        # Erstelle Drucker-Objekt
        printer = {
            'id': str(uuid.uuid4()),
            'name': data['name'],
            'ip': data.get('ip'),  # Optional für Cloud-Drucker
            'accessCode': data['accessCode'],
            'isCloud': data.get('isCloud', False),
            'cloudId': data.get('cloudId')
        }
        
        # Starte Stream
        stream_url = f"rtsps://bblp:{printer['accessCode']}@{printer['ip']}:322/streaming/live/1"
        port = getNextPort()
        
        if stream_service.start_stream(printer['id'], stream_url, port):
            printer['wsPort'] = port
            stored_printers[printer['id']] = printer
            return jsonify({'success': True, 'printer': printer})
        else:
            return jsonify({
                'success': False, 
                'error': 'Connection error',
                'details': 'Konnte keine Verbindung zum Drucker herstellen'
            }), 400
            
    except Exception as e:
        logger.error(f"Error adding printer: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400 