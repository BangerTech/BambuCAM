from .printerService import scanNetwork, getPrinterStatus, addPrinter, getPrinters, removePrinter
from .streamService import startStream 
import uuid
import subprocess
import logging

logger = logging.getLogger(__name__)

def addPrinter(data):
    """Fügt einen neuen Drucker hinzu"""
    try:
        printer = {
            'id': str(uuid.uuid4()),  # Eindeutige ID
            'name': data['name'],
            'ip': data['ip'],
            'accessCode': data['accessCode'],
            'streamUrl': f"rtsps://bblp:{data['accessCode']}@{data['ip']}:322/streaming/live/1",
            'wsPort': getNextPort()  # Dynamischer WebSocket Port
        }
        
        # Teste die Verbindung
        testStream = startStream(printer['id'], printer['streamUrl'])
        if not testStream:
            raise Exception("Konnte keine Verbindung zum Drucker herstellen")
            
        printers = getPrinters()
        printers.append(printer)
        savePrinters(printers)
        
        return printer
        
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen des Druckers: {str(e)}")
        raise e

def startStream(printer_id, stream_url=None):
    """Startet einen neuen RTSP zu WebSocket Stream"""
    try:
        if not stream_url:
            printer = getPrinterById(printer_id)
            if not printer:
                raise Exception("Drucker nicht gefunden")
            stream_url = printer['streamUrl']
            
        port = printer.get('wsPort', getNextPort())
        
        # Stoppe existierenden Stream falls vorhanden
        stopStream(printer_id)
        
        # Starte FFmpeg Prozess
        command = [
            'ffmpeg',
            '-fflags', 'nobuffer',
            '-flags', 'low_delay',
            '-strict', 'experimental',
            '-rtsp_transport', 'tcp',  # TCP für stabilere Verbindung
            '-i', stream_url,
            '-vsync', '0',
            '-copyts',
            '-vcodec', 'copy',
            '-movflags', 'frag_keyframe+empty_moov',
            '-an',
            '-hls_flags', 'delete_segments+append_list',
            '-f', 'mpegts',
            f'http://localhost:{port}'
        ]
        
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Speichere Prozess-ID
        active_streams[printer_id] = {
            'process': process,
            'port': port
        }
        
        return port
        
    except Exception as e:
        logger.error(f"Fehler beim Starten des Streams: {str(e)}")
        raise e 