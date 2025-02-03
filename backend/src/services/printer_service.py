import uuid
from datetime import datetime
import json

def addPrinter(printer_data):
    """Fügt einen neuen Drucker hinzu"""
    try:
        printer_type = printer_data.get('type', '').upper()
        ip = printer_data.get('ip', '')
        
        if not ip:
            return False, "IP address is required"

        if printer_type == 'BAMBULAB':
            access_code = printer_data.get('accessCode')
            if not access_code:
                return False, "Access code is required for Bambulab printers"
            
            # Erstelle eine saubere ID ohne Sonderzeichen
            safe_name = printer_data.get('name', '').replace('#', 'nr').replace(' ', '_')
            printer_id = f"printer_{ip.replace('.', '_')}_{safe_name}"
                
            printer = {
                'id': printer_id,  # Setze ID direkt
                'name': printer_data.get('name', f'Bambulab ({ip})'),
                'ip': ip,
                'type': 'BAMBULAB',
                'accessCode': access_code,
                'streamUrl': f"rtsp://bblp:{access_code}@{ip}:322/streaming/live/1",  # rtsp statt rtsps
                'mqttPort': 8883,
                'mqttUser': 'bblp',
                'mqttPassword': access_code,
                'status': 'online'
            }

            # Speichere Drucker
            stored_printers[printer_id] = printer
            savePrinters()
            
            return True, printer

        elif printer_type == 'CREALITY_K1':
            # ... existierender K1 Code ...

    except Exception as e:
        logger.error(f"Error adding printer: {e}")
        return False, str(e)

def removePrinter(printer_id):
    """Entfernt einen Drucker"""
    try:
        if printer_id in stored_printers:
            del stored_printers[printer_id]
            savePrinters()  # Speichere die Änderungen
            return True
        return False
    except Exception as e:
        logger.error(f"Error removing printer {printer_id}: {e}")
        raise Exception(f"Could not remove printer: {str(e)}")

def savePrinters():
    """Speichert Drucker in JSON-Datei"""
    try:
        with open('printers.json', 'w') as f:
            json.dump(stored_printers, f)
            logger.debug(f"Saved {len(stored_printers)} printers to storage")
    except Exception as e:
        logger.error(f"Error saving printers: {e}") 