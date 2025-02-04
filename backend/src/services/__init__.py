from .printerService import scanNetwork, getPrinterStatus, getPrinters, removePrinter, getPrinterById, savePrinters
from .streamService import startStream, stopStream, getNextPort
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
    """Startet einen neuen RTSP zu WebSocket Stream"""
    try:
        # Stoppe existierenden Stream falls vorhanden
        stopStream(printer_id)
        
        # Finde freien Port
        port = getNextPort()
        
        if not stream_url:
            printer = getPrinterById(printer_id)
            if not printer:
                raise Exception("Drucker nicht gefunden")
            stream_url = printer['streamUrl']
        
        # Exakt die gleichen Parameter wie im funktionierenden Test
        command = [
            'ffmpeg',
            '-rtsp_transport', 'tcp',
            '-i', stream_url,
            '-c:v', 'copy',
            '-f', 'mpegts',
            f'pipe:1'  # Stream zur stdout statt HTTP
        ]
        
        logger.info(f"Starting FFmpeg with command: {' '.join(command)}")
        
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=False  # Binary mode für Video
        )
        
        # Warte kurz und prüfe ob der Prozess noch läuft
        time.sleep(1)
        if process.poll() is not None:
            # Prozess ist bereits beendet - hole Fehlerausgabe
            _, stderr = process.communicate()
            logger.error(f"FFmpeg process failed: {stderr.decode()}")
            raise Exception("FFmpeg process failed to start")
            
        # Speichere Prozess-ID
        active_streams[printer_id] = {
            'process': process,
            'port': port
        }
        
        logger.info(f"Stream started successfully on port {port}")
        return port
        
    except Exception as e:
        logger.error(f"Fehler beim Starten des Streams: {str(e)}")
        raise e 