import socket
import json
import logging
import asyncio
import os
from datetime import datetime
import requests
from pathlib import Path
import time
import uuid

# Logger konfigurieren
logger = logging.getLogger(__name__)

# Bambu Lab Ports
MQTT_PORT = 8883
DISCOVERY_PORT = 2023

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
                data = json.load(f)
                # Stelle sicher, dass wir eine Liste zurückgeben
                return data if isinstance(data, list) else []
        return []
    except Exception as e:
        logger.error(f"Fehler beim Laden der Drucker: {str(e)}")
        return []

def savePrinters(printers):
    """Speichert die Drucker-Liste"""
    try:
        # Stelle sicher, dass wir eine Liste speichern
        if not isinstance(printers, list):
            printers = list(printers.values()) if isinstance(printers, dict) else []
            
        with open(PRINTERS_FILE, 'w') as f:
            json.dump(printers, f, indent=2)
    except Exception as e:
        logger.error(f"Fehler beim Speichern der Drucker: {str(e)}")
        raise e

def getPrinterById(printer_id):
    """Findet einen Drucker anhand seiner ID"""
    printers = getPrinters()
    if isinstance(printers, list):
        for printer in printers:
            if printer.get('id') == printer_id:
                return printer
    return None

def addPrinter(data):
    """Fügt einen neuen Drucker hinzu"""
    try:
        printers = getPrinters()
        if not isinstance(printers, list):
            printers = []
        printers.append(data)
        savePrinters(printers)
        return data
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen des Druckers: {str(e)}")
        raise e

def removePrinter(printer_id):
    """Entfernt einen Drucker anhand seiner ID"""
    try:
        printers = getPrinters()
        if isinstance(printers, list):
            printers = [p for p in printers if p.get('id') != printer_id]
            savePrinters(printers)
            return True
        return False
    except Exception as e:
        logger.error(f"Fehler beim Entfernen des Druckers: {str(e)}")
        return False

def getPrinterStatus(printer_id):
    """Holt den Status eines Druckers über die Bambu Lab API"""
    try:
        printer = getPrinterById(printer_id)
        if not printer:
            raise Exception("Drucker nicht gefunden")
            
        # Bambu Lab API Endpoint (HTTPS)
        url = f"https://{printer['ip']}:8989/api/info"
        logger.info(f"Requesting printer status from: {url}")
        
        response = requests.get(
            url, 
            headers={
                "Authorization": f"Bearer {printer['accessCode']}"
            },
            verify=False,  # Selbst-signierte Zertifikate erlauben
            timeout=5
        )
        
        logger.info(f"Printer API Response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Printer data: {data}")
            return {
                "temperatures": {
                    "bed": float(data.get('bed_temp', 0)),
                    "nozzle": float(data.get('nozzle_temp', 0))
                },
                "printTime": {
                    "remaining": int(data.get('remaining_time', 0))
                },
                "status": data.get('status', 'unknown'),
                "progress": float(data.get('progress', 0))
            }
        else:
            raise Exception(f"API Error: {response.status_code}")
            
    except Exception as e:
        logger.error(f"Fehler beim Abrufen des Drucker-Status: {str(e)}")
        # Fallback-Werte
        return {
            "temperatures": {"bed": 0, "nozzle": 0},
            "printTime": {"remaining": 0},
            "status": "offline",
            "progress": 0
        }

def scanNetwork():
    """Scannt nach neuen Druckern im Netzwerk"""
    try:
        logger.info("Starting network scan for printers...")
        
        # Bambu Lab Discovery Message
        discovery_msg = {
            "command": "info",
            "sequence_id": 0,
            "parameters": {}
        }
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(('0.0.0.0', 0))
        
        message = json.dumps(discovery_msg)
        logger.info(f"Sending discovery message: {message}")
        
        # Sende an den Discovery-Port
        sock.sendto(message.encode(), ('255.255.255.255', DISCOVERY_PORT))
        
        # Sammle Antworten
        printers = []
        sock.settimeout(5.0)
        
        try:
            while True:
                data, addr = sock.recvfrom(2048)
                logger.info(f"Received response from {addr}: {data}")
                
                try:
                    response = json.loads(data.decode())
                    logger.info(f"Parsed response: {response}")
                    
                    printer_info = {
                        "id": str(uuid.uuid4()),
                        "name": response.get("name", f"Bambu Lab Printer {addr[0]}"),
                        "ip": addr[0],
                        "type": "bambulab",
                        "status": "online"
                    }
                    
                    printers.append(printer_info)
                    
                except json.JSONDecodeError as e:
                    logger.warning(f"Invalid JSON from {addr}: {e}")
                    
        except socket.timeout:
            pass
            
        logger.info(f"Scan complete. Found {len(printers)} printers")
        return printers
        
    except Exception as e:
        logger.error(f"Error during network scan: {str(e)}")
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