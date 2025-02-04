import socket
import json
import logging
import asyncio
import os
from datetime import datetime
import requests
from pathlib import Path

# Logger konfigurieren
logger = logging.getLogger(__name__)

# Bambu Lab Ports
MQTT_PORT = 8883
DISCOVERY_PORT = 8991

# Globale Variable für gespeicherte Drucker
stored_printers = {}

# Pfad zur JSON-Datei
PRINTERS_FILE = Path(os.getenv('PRINTERS_FILE', 'printers.json'))

async def test_stream_url(url):
    """Testet ob eine Stream-URL erreichbar ist"""
    try:
        command = [
            'ffmpeg',
            '-rtsp_transport', 'tcp',
            '-i', url,
            '-t', '1',
            '-f', 'null',
            '-'
        ]
        
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        try:
            await asyncio.wait_for(process.communicate(), timeout=2.0)
            return process.returncode == 0
        except asyncio.TimeoutError:
            process.kill()
            return False
            
    except Exception as e:
        logger.debug(f"Error testing stream URL {url}: {e}")
        return False

def getPrinters():
    """Lädt die gespeicherten Drucker"""
    try:
        if PRINTERS_FILE.exists():
            with open(PRINTERS_FILE, 'r') as f:
                return json.load(f)
        return []
    except Exception as e:
        logger.error(f"Fehler beim Laden der Drucker: {str(e)}")
        return []

def savePrinters(printers):
    """Speichert die Drucker-Liste"""
    try:
        with open(PRINTERS_FILE, 'w') as f:
            json.dump(printers, f)
    except Exception as e:
        logger.error(f"Fehler beim Speichern der Drucker: {str(e)}")
        raise e

def getPrinterById(printer_id):
    """Findet einen Drucker anhand seiner ID"""
    printers = getPrinters()
    for printer in printers:
        if printer['id'] == printer_id:
            return printer
    return None

def addPrinter(data):
    """Fügt einen neuen Drucker hinzu"""
    printers = getPrinters()
    printers.append(data)
    savePrinters(printers)
    return data

def removePrinter(printer_id):
    """Entfernt einen Drucker anhand seiner ID"""
    printers = getPrinters()
    printers = [p for p in printers if p['id'] != printer_id]
    savePrinters(printers)
    return True

def getPrinterStatus(printer_id):
    """Holt den Status eines Druckers"""
    printer = getPrinterById(printer_id)
    if not printer:
        raise Exception("Drucker nicht gefunden")
        
    # TODO: Implementiere echte Status-Abfrage
    return {
        "temperatures": {
            "bed": 60.0,
            "nozzle": 200.0
        },
        "printTime": {
            "remaining": 1800
        },
        "status": "printing",
        "progress": 45
    }

def scanNetwork():
    """Scannt nach neuen Druckern"""
    try:
        # UDP Socket für Discovery
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.settimeout(1)

        # Bambu Lab spezifische Discovery Message
        discovery_msg = {
            "sequence_id": "0",
            "command": "get_version",
            "parameters": ""
        }
        message = json.dumps(discovery_msg)
        sock.sendto(message.encode(), ('255.255.255.255', DISCOVERY_PORT))

        # Auf Antworten warten
        printers = []
        while True:
            try:
                data, addr = sock.recvfrom(1024)
                response = json.loads(data.decode())
                
                # Drucker zur Liste hinzufügen
                printer_info = {
                    "id": response.get("dev_id", f"printer_{len(printers) + 1}"),
                    "name": response.get("dev_name", f"Bambu Lab Printer {addr[0]}"),
                    "ip": addr[0],
                    "type": "bambulab",
                    "status": "online",
                    "serial": response.get("dev_sn", "unknown")
                }
                printers.append(printer_info)
            except socket.timeout:
                break
            except json.JSONDecodeError:
                continue

        # Kombiniere gescannte und gespeicherte Drucker
        all_printers = printers + getPrinters()
        return all_printers
    except Exception as e:
        print(f"Error scanning network: {str(e)}")
        return []
    finally:
        sock.close()

def startPrint(printer_id, file_path):
    """Startet einen Druck"""
    try:
        printer = getPrinterById(printer_id)
        if not printer:
            return False
            
        url = f"http://{printer['ip']}/api/v1/print"
        headers = {
            "Authorization": f"Bearer {printer['accessCode']}"
        }
        data = {
            "file": file_path
        }
        
        response = requests.post(url, headers=headers, json=data)
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Error starting print: {e}")
        return False

def stopPrint(printer_id):
    """Stoppt den aktuellen Druck"""
    try:
        printer = getPrinterById(printer_id)
        if not printer:
            return False
            
        url = f"http://{printer['ip']}/api/v1/print/stop"
        headers = {
            "Authorization": f"Bearer {printer['accessCode']}"
        }
        
        response = requests.post(url, headers=headers)
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Error stopping print: {e}")
        return False

# MQTT Callbacks
def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")

def on_message(client, userdata, msg):
    print(f"Message received on {msg.topic}: {msg.payload}")

# Lade gespeicherte Drucker beim Start
stored_printers = getPrinters() 