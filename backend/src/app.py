from flask import Flask, jsonify, request
from flask_cors import CORS  # Importiere CORS
from services.printerService import addPrinter, removePrinter, getPrinters, stored_printers
from services.streamService import startStream

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})  # Aktiviere CORS für alle Routen

@app.route('/printers/<printer_id>', methods=['DELETE'])
def delete_printer(printer_id):
    try:
        removePrinter(printer_id)
        return jsonify({"message": f"Printer {printer_id} removed"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400 