from flask import jsonify, Blueprint, request
from src.services.streamService import stream_service
from src.services.printerService import removePrinter, getPrinters, addPrinter
from src.services import scanNetwork
from src.utils.logger import logger

printers_bp = Blueprint('printers', __name__)

@printers_bp.route('/printers', methods=['GET'])
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
        data = request.json
        printer = addPrinter(data)
        return jsonify({
            'success': True,
            'printer': printer
        })
    except Exception as e:
        logger.error(f"Error adding printer: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
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