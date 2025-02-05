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
import paho.mqtt.client as mqtt
import bambulabs_api as bl

# Logger konfigurieren
logger = logging.getLogger(__name__)

# Bambu Lab Ports
MQTT_PORT = 8883
DISCOVERY_PORT = 1990
SSDP_PORT = 2021
RTSP_PORT = 322

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
    """Gets the printer status using BambuLab API with MQTT subscription"""
    try:
        printer = getPrinterById(printer_id)
        if not printer:
            raise Exception("Printer not found")
            
        # Create API instance with MQTT enabled
        bambu_printer = bl.Printer(
            printer['ip'],
            printer['accessCode'],
            "UNKNOWN",              
            push_mqtt=True          # Enable MQTT subscription
        )
        
        try:
            # Connect to printer
            logger.info(f"Connecting to printer at {printer['ip']}")
            if not bambu_printer.connect():
                logger.error("Could not connect to printer")
                return {
                    "temperatures": {"bed": 0, "nozzle": 0},
                    "status": "offline",
                    "progress": 0
                }

            # Wait for MQTT connection
            time.sleep(2)
            
            try:
                # Get data from MQTT dump first
                mqtt_data = bambu_printer.mqtt_dump()
                if mqtt_data:
                    logger.debug(f"MQTT Data: {mqtt_data}")
                    return {
                        "temperatures": {
                            "bed": float(mqtt_data.get("bed_temp", 0)),
                            "nozzle": float(mqtt_data.get("nozzle_temp", 0))
                        },
                        "status": mqtt_data.get("print_status", "unknown"),
                        "progress": float(mqtt_data.get("progress", 0))
                    }
                    
                # Fallback to direct API calls if MQTT fails
                logger.warning("No MQTT data available, using direct API calls")
                status = bambu_printer.get_state()
                bed_temp = bambu_printer.get_bed_temperature()
                nozzle_temp = bambu_printer.get_nozzle_temperature()
                progress = bambu_printer.get_print_progress()
                
                logger.debug(f"API Data - Status: {status}, Bed: {bed_temp}, Nozzle: {nozzle_temp}, Progress: {progress}")
                
                return {
                    "temperatures": {
                        "bed": float(bed_temp or 0),
                        "nozzle": float(nozzle_temp or 0)
                    },
                    "status": status or "unknown",
                    "progress": float(progress or 0)
                }
                
            except Exception as e:
                logger.error(f"Error getting printer data: {e}")
                return {
                    "temperatures": {"bed": 0, "nozzle": 0},
                    "status": "error",
                    "progress": 0
                }
                
        finally:
            try:
                bambu_printer.disconnect()
            except:
                pass
            
    except Exception as e:
        logger.error(f"Error getting printer status: {str(e)}")
        return {
            "temperatures": {"bed": 0, "nozzle": 0},
            "status": "offline",
            "progress": 0
        }

def scanNetwork():
    """Scannt nach neuen Druckern im Netzwerk via SSDP"""
    try:
        logger.info("Starting network scan for printers...")
        
        # SSDP M-SEARCH Message für Bambu Lab Drucker
        ssdp_request = (
            'M-SEARCH * HTTP/1.1\r\n'
            'HOST: 239.255.255.250:1990\r\n'
            'MAN: "ssdp:discover"\r\n'
            'MX: 3\r\n'
            'ST: urn:bambulab-com:device:3dprinter:1\r\n'
            '\r\n'
        )
        
        # Erstelle UDP Socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        
        # Bind to all interfaces
        sock.bind(('', 0))
        
        # Sende an beide SSDP Ports
        discovery_ports = [DISCOVERY_PORT, SSDP_PORT]
        for port in discovery_ports:
            try:
                logger.info(f"Sending SSDP discovery to port {port}")
                sock.sendto(ssdp_request.encode(), ('239.255.255.250', port))
            except Exception as e:
                logger.error(f"Error sending to port {port}: {e}")
        
        # Sammle Antworten
        printers = []
        sock.settimeout(3.0)
        
        try:
            while True:
                try:
                    data, addr = sock.recvfrom(2048)
                    response = data.decode()
                    logger.info(f"Received from {addr}: {response}")
                    
                    # Parse SSDP Response
                    if 'bambulab' in response.lower():
                        # Extrahiere Informationen aus der SSDP Antwort
                        lines = response.split('\r\n')
                        printer_info = {
                            'id': str(uuid.uuid4()),
                            'ip': addr[0],
                            'type': 'bambulab',
                            'status': 'online'
                        }
                        
                        # Suche nach Namen und anderen Details
                        for line in lines:
                            if 'DevName.bambu.com:' in line:
                                printer_info['name'] = line.split(':', 1)[1].strip()
                            elif 'DevModel.bambu.com:' in line:
                                printer_info['model'] = line.split(':', 1)[1].strip()
                            elif 'DevVersion.bambu.com:' in line:
                                printer_info['version'] = line.split(':', 1)[1].strip()
                        
                        if not printer_info.get('name'):
                            printer_info['name'] = f"Bambu Lab Printer {addr[0]}"
                            
                        # Prüfe ob der Drucker bereits gefunden wurde
                        if not any(p['ip'] == addr[0] for p in printers):
                            printers.append(printer_info)
                            logger.info(f"Found printer: {printer_info}")
                            
                except socket.timeout:
                    break
                    
        except Exception as e:
            logger.error(f"Error receiving responses: {e}")
            
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
    logger.info(f"MQTT Connected with result code: {rc}")
    if rc == 0:
        client.subscribe("device/+/report")

def on_message(client, userdata, msg):
    logger.debug(f"MQTT Message received: {msg.topic} {msg.payload}")

# Lade gespeicherte Drucker beim Start
stored_printers = getPrinters() 