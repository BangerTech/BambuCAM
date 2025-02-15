from flask import jsonify, Blueprint, request
from flask_cors import cross_origin
from src.services.streamService import stream_service
from src.services import (
    addPrinter,
    getPrinters,
    getPrinterById,
    removePrinter,
    scanNetwork,
    printer_service,
    get_creality_status
)
import logging
import json
import uuid
import requests
import os

logger = logging.getLogger(__name__)
printers_bp = Blueprint('printers', __name__, url_prefix='/api')

def getNextPort() -> int:
    """
    Findet den nächsten freien Port für einen neuen Drucker.
    Startet bei 8554 und erhöht um 1 bis ein freier Port gefunden wird.
    """
    try:
        printers_dir = 'data/printers'
        used_ports = []
        
        # Durchsuche alle Drucker-Dateien
        for printer_file in os.listdir(printers_dir):
            if printer_file.endswith('.json'):
                with open(os.path.join(printers_dir, printer_file), 'r') as f:
                    printer = json.load(f)
                    used_ports.append(printer.get('port', 0))
                    
        if not used_ports:
            return 8554  # Startport wenn keine Drucker existieren
        return max(used_ports) + 1
    except FileNotFoundError:
        return 8554  # Startport wenn Verzeichnis nicht existiert
    except json.JSONDecodeError:
        return 8554  # Startport wenn JSON ungültig

def save_printer(printer_data: dict) -> None:
    """
    Speichert einen neuen Drucker in seiner eigenen JSON-Datei.
    """
    try:
        printer_id = printer_data['id']
        printer_dir = 'data/printers'
        
        # Stelle sicher, dass das Verzeichnis existiert
        os.makedirs(printer_dir, exist_ok=True)
        
        # Speichere Drucker in seiner eigenen Datei
        printer_file = os.path.join(printer_dir, f"{printer_id}.json")
        with open(printer_file, 'w') as f:
            json.dump(printer_data, f, indent=2)

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

@printers_bp.route('/printers', methods=['POST'])
def add_printer():
    try:
        printer_data = request.json
        logger.info(f"Received printer data: {printer_data}")
        
        # Validiere erforderliche Felder
        required_fields = ['name', 'ip', 'type']
        missing_fields = [field for field in required_fields if not printer_data.get(field)]
        
        if missing_fields:
            error_msg = f"Missing required fields: {missing_fields}"
            logger.error(error_msg)
            return jsonify({
                'error': error_msg,
                'required': required_fields,
                'missing': missing_fields,
                'received': printer_data
            }), 400

        # Erstelle neuen Drucker
        try:
            new_printer = addPrinter(printer_data)
            logger.info(f"Successfully added printer: {new_printer}")
            
            return jsonify({
                'success': True,
                'printer': new_printer
            }), 200  # Wichtig: Status 200 für erfolgreiche Anfrage
            
        except Exception as e:
            logger.error(f"Error in printer creation process: {str(e)}", exc_info=True)
            return jsonify({
                'error': f'Error creating printer: {str(e)}',
                'success': False
            }), 500  # Server Error für interne Fehler

    except Exception as e:
        logger.error(f"Error in request processing: {str(e)}", exc_info=True)
        return jsonify({
            'error': f'Error processing request: {str(e)}',
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

@printers_bp.route('/printers/<printer_id>/status', methods=['GET'])
def get_printer_status(printer_id):
    try:
        logger.info(f"Getting status for printer: {printer_id}")
        
        # Lade den spezifischen Drucker
        printer_file = f'data/printers/{printer_id}.json'
        try:
            with open(printer_file, 'r') as f:
                printer = json.load(f)
                logger.debug(f"Loaded printer data: {printer}")
        except FileNotFoundError:
            logger.error(f"Printer file not found: {printer_file}")
            return jsonify({'error': 'Printer not found'}), 404

        # Für Creality/Klipper Drucker
        if printer['type'] == 'CREALITY':
            try:
                logger.debug(f"Attempting to connect to Creality printer at: {printer['ip']}")
                response = requests.get(f"http://{printer['ip']}:80/printer/info", timeout=5)
                if response.ok:
                    printer_data = response.json()
                    logger.debug(f"Received printer data: {printer_data}")
                    status_data = {
                        'status': 'online',
                        'temperatures': {
                            'nozzle': printer_data.get('temperature', {}).get('tool0', 0),
                            'bed': printer_data.get('temperature', {}).get('bed', 0)
                        },
                        'progress': printer_data.get('progress', {}).get('completion', 0)
                    }
                    
                    # Update die Drucker-Datei mit den neuen Status-Daten
                    printer.update(status_data)
                    with open(printer_file, 'w') as f:
                        json.dump(printer, f, indent=2)
                        
                    return jsonify(status_data)
            except:
                pass

            # Wenn keine Verbindung möglich ist
            status_data = {
                'status': 'offline',
                'temperatures': {
                    'nozzle': 0,
                    'bed': 0
                },
                'progress': 0
            }
            
            # Update die Drucker-Datei
            printer.update(status_data)
            with open(printer_file, 'w') as f:
                json.dump(printer, f, indent=2)
                
            return jsonify(status_data)

        # Für Bambu Lab Drucker
        elif printer['type'] == 'BAMBULAB':
            # Hier die existierende Bambu Lab Status-Logik
            return jsonify({
                'status': printer.get('status', 'offline'),
                'temperatures': printer.get('temperatures', {
                    'nozzle': 0,
                    'bed': 0,
                    'chamber': 0
                }),
                'progress': printer.get('progress', 0)
            })

        return jsonify({
            'status': 'unknown',
            'temperatures': {
                'nozzle': 0,
                'bed': 0
            },
            'progress': 0
        })

    except Exception as e:
        logger.error(f"Error getting printer status: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@printers_bp.route('/printers/<printer_id>/status', methods=['PUT'])
def update_status(printer_id):
    try:
        status_data = request.json
        update_printer_status(printer_id, status_data)
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error updating printer status: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500 