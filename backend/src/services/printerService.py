import uuid
from datetime import datetime
import json
import socket
import logging
import os
from bambulabs_api import Printer

# Setup logging
logger = logging.getLogger(__name__)

# Globale Variable für gespeicherte Drucker
stored_printers = {}

def loadPrinters():
    """Lädt Drucker aus JSON-Datei"""
    global stored_printers
    try:
        if os.path.exists('printers.json'):
            with open('printers.json', 'r') as f:
                stored_printers = json.load(f)
                logger.debug(f"Loaded {len(stored_printers)} printers from storage")
    except Exception as e:
        logger.error(f"Error loading printers: {e}")
        stored_printers = {}

def getPrinters():
    """Gibt alle gespeicherten Drucker zurück"""
    try:
        loadPrinters()  # Lade aktuelle Drucker
        return list(stored_printers.values())
    except Exception as e:
        logger.error(f"Error getting printers: {e}")
        return []

def addPrinter(printer_data):
    """Fügt einen neuen Drucker hinzu"""
    try:
        ip = printer_data.get('ip', '')
        if not ip:
            return False, "IP address is required"

        access_code = printer_data.get('accessCode')
        if not access_code:
            return False, "Access code is required for Bambulab printers"
        
        # Erstelle eine saubere ID ohne Sonderzeichen
        safe_name = printer_data.get('name', '').replace('#', 'nr').replace(' ', '_')
        printer_id = f"printer_{ip.replace('.', '_')}_{safe_name}"
            
        printer = {
            'id': printer_id,
            'name': printer_data.get('name', f'Bambulab ({ip})'),
            'ip': ip,
            'type': 'BAMBULAB',
            'accessCode': access_code,
            'streamUrl': f"rtsp://bblp:{access_code}@{ip}:322/streaming/live/1",
            'mqttPort': 8883,
            'mqttUser': 'bblp',
            'mqttPassword': access_code,
            'status': 'online'
        }

        # Speichere Drucker
        stored_printers[printer_id] = printer
        savePrinters()
        
        return True, printer

    except Exception as e:
        logger.error(f"Error adding printer: {e}")
        return False, str(e)

def removePrinter(printer_id):
    """Entfernt einen Drucker"""
    try:
        if printer_id in stored_printers:
            del stored_printers[printer_id]
            savePrinters()
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

def scanNetwork():
    """Scannt nach Bambulab Druckern im Netzwerk"""
    try:
        logger.info("Using default fallback network")
        network = "192.168.2.0/24"  # Default Netzwerk
        logger.info(f"Scanning networks: [{network}]")
        
        found_printers = []
        
        # Hier könnte man noch die Scan-Logik implementieren
        # Für jetzt geben wir einfach die gespeicherten Drucker zurück
        found_printers.extend(getPrinters())
        
        return found_printers
    except Exception as e:
        logger.error(f"Error scanning network: {e}")
        return []

def getPrinterStatus(printer_id):
    """Holt den Status eines Druckers via Bambulab API"""
    try:
        if printer_id in stored_printers:
            printer = stored_printers[printer_id]
            
            # Verbinde mit Bambulab Drucker
            bambu_printer = Printer(
                ip=printer['ip'], 
                access_code=printer['accessCode']
            )
            
            # Hole Druckerstatus
            status = bambu_printer.get_state()
            logger.debug(f"Received printer status: {status}")  # Debug-Log
            
            return {
                "temperatures": {
                    "bed": float(status.get('temperature', {}).get('bed', {}).get('actual', 0)),
                    "nozzle": float(status.get('temperature', {}).get('nozzle', {}).get('actual', 0))
                },
                "printTime": {
                    "remaining": int(status.get('print', {}).get('time_remaining', 0))
                },
                "status": status.get('print', {}).get('status', 'unknown'),
                "progress": float(status.get('print', {}).get('progress', 0) * 100)  # Umrechnung in Prozent
            }
            
        return None
    except Exception as e:
        logger.error(f"Error getting printer status: {e}")
        return None

# Lade Drucker beim Start
loadPrinters() 