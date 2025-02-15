from flask import jsonify, Blueprint, request
from src.services.streamService import stream_service
from src.services.printerService import removePrinter, getPrinters, addPrinter
from src.services import scanNetwork
from src.utils.logger import logger
from flask_cors import cross_origin
import logging
import json
import uuid

logger = logging.getLogger(__name__)
printers_bp = Blueprint('printers', __name__)

def getNextPort() -> int:
    """
    Findet den nächsten freien Port für einen neuen Drucker.
    Startet bei 8554 und erhöht um 1 bis ein freier Port gefunden wird.
    """
    try:
        with open('data/printers.json', 'r') as f:
            printers = json.load(f)
            used_ports = [p.get('port', 0) for p in printers]
            if not used_ports:
                return 8554  # Startport wenn keine Drucker existieren
            return max(used_ports) + 1
    except FileNotFoundError:
        return 8554  # Startport wenn Datei nicht existiert
    except json.JSONDecodeError:
        return 8554  # Startport wenn JSON ungültig

def save_printer(printer_data: dict) -> None:
    """
    Speichert einen neuen Drucker in der printers.json Datei.
    """
    try:
        printers = []
        try:
            with open('data/printers.json', 'r') as f:
                printers = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            # Wenn die Datei nicht existiert oder leer ist, starte mit leerer Liste
            pass

        # Füge neuen Drucker hinzu
        printers.append(printer_data)

        # Speichere aktualisierte Liste
        with open('data/printers.json', 'w') as f:
            json.dump(printers, f, indent=2)

    except Exception as e:
        logger.error(f"Fehler beim Speichern des Druckers: {str(e)}")
        raise Exception(f"Failed to save printer: {str(e)}")

@printers_bp.route('/printers', methods=['GET'])
@cross_origin()
def get_printers():
    try:
        printers = getPrinters()
        return jsonify(printers)
    except Exception as e:
        logger.error(f"Error getting printers: {e}")
        return jsonify({"error": str(e)}), 500

@printers_bp.route('/api/printers', methods=['POST'])
def add_printer():
    try:
        printer_data = request.json
        
        # Validiere erforderliche Felder
        required_fields = ['name', 'ip', 'type']
        if not all(field in printer_data for field in required_fields):
            return jsonify({
                'error': 'Missing required fields',
                'required': required_fields
            }), 400

        # Füge zusätzliche Felder hinzu
        printer_data['id'] = str(uuid.uuid4())
        printer_data['port'] = getNextPort()
        printer_data['status'] = 'offline'
        printer_data['temperatures'] = {
            'nozzle': 0,
            'bed': 0,
            'chamber': 0
        }
        printer_data['progress'] = 0

        # Speichere den Drucker
        save_printer(printer_data)

        return jsonify({
            'success': True,
            'printer': printer_data
        })

    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen des Druckers: {str(e)}")
        return jsonify({
            'error': f'Error adding printer: {str(e)}',
            'success': False
        }), 400

@printers_bp.route('/printers/<printer_id>', methods=['DELETE'])
def delete_printer(printer_id):
    try:
        stream_service.stop_stream(printer_id)
        success = removePrinter(printer_id)
        if success:
            return jsonify({"message": "Printer removed successfully"}), 200
        return jsonify({"error": "Printer not found"}), 404
    except Exception as e:
        logger.error(f"Error deleting printer: {e}")
        return jsonify({"error": str(e)}), 500

@printers_bp.route('/scan', methods=['GET'])
def scan_network():
    try:
        printers = scanNetwork()
        return jsonify({"printers": printers})
    except Exception as e:
        logger.error(f"Error scanning network: {e}")
        return jsonify({"error": str(e)}), 500 