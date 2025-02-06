from flask import Flask, jsonify, request
from flask_cors import CORS
from src.services import scanNetwork, getPrinterStatus, startStream, addPrinter, getPrinters, removePrinter
from src.routes.system import system_bp

app = Flask(__name__)

# Blueprint ZUERST registrieren
app.register_blueprint(system_bp)

# Dann erst CORS konfigurieren
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "expose_headers": ["Content-Type"]
    }
})

@app.route('/printers/<printer_id>', methods=['DELETE'])
def delete_printer(printer_id):
    try:
        success = removePrinter(printer_id)
        if success:
            return jsonify({"message": f"Printer {printer_id} removed"}), 200
        else:
            return jsonify({"error": "Printer not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ... andere Routes ... 