from .printerService import (
    scanNetwork, 
    getPrinterStatus,
    getPrinters, 
    removePrinter, 
    getPrinterById, 
    savePrinters,
    printer_service
)
from .streamService import startStream, stopStream, getNextPort, stream_service
import uuid
import subprocess
import logging
import time

logger = logging.getLogger(__name__)

# Globale Variable für aktive Streams
active_streams = {}

def addPrinter(data):
    """Fügt einen neuen Drucker hinzu"""
    try:
        # Erstelle Drucker-Objekt mit allen nötigen Daten
        printer = {
            'id': str(uuid.uuid4()),
            'name': data['name'],
            'ip': data['ip'],
            'accessCode': data['accessCode'],
            # Korrekte Stream-URL für BambuLab
            'streamUrl': f"rtsps://bblp:{data['accessCode']}@{data['ip']}:322/streaming/live/1",
            'wsPort': getNextPort()
        }
        
        # Teste die Verbindung
        testStream = startStream(printer['id'], printer['streamUrl'])
        if not testStream:
            raise Exception("Konnte keine Verbindung zum Drucker herstellen")
            
        # Hole aktuelle Drucker-Liste und füge neuen Drucker hinzu
        current_printers = getPrinters()
        current_printers.append(printer)
        savePrinters(current_printers)
        
        return printer
        
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen des Druckers: {str(e)}")
        raise e

def startStream(printer_id, stream_url=None):
    """Startet einen Stream"""
    try:
        if not stream_url:
            printer = getPrinterById(printer_id)
            if not printer:
                raise Exception(f"Printer {printer_id} not found")
            stream_url = printer.get('streamUrl')
            
        if not stream_url:
            raise Exception("No stream URL available")
            
        # Hole nächsten freien Port
        port = getNextPort()
        
        # Starte Stream über StreamService
        return stream_service.start_stream(printer_id, stream_url, port)
        
    except Exception as e:
        logger.error(f"Error starting stream: {e}")
        raise e

def stopStream(printer_id):
    """Stoppt einen Stream"""
    stream_service.stop_stream(printer_id) 