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
import ssl

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
    """Speichert die Drucker in der JSON-Datei"""
    try:
        with open(PRINTERS_FILE, 'w') as f:
            json.dump(printers, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving printers: {e}")
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
    """Gets the printer status using MQTT"""
    try:
        printer = getPrinterById(printer_id)
        if not printer:
            raise Exception("Printer not found")
            
        # Store received data
        received_data = {}
        connection_established = False
        
        # MQTT callbacks
        def on_connect(client, userdata, flags, rc):
            nonlocal connection_established
            logger.info(f"MQTT Connected with result code: {rc}")
            if rc == 0:
                connection_established = True
                # Subscribe to printer status topic
                client.subscribe(f"device/+/report")
                logger.info(f"Subscribed to topic: device/+/report")
            else:
                logger.error(f"Connection failed with code {rc}")
        
        def on_message(client, userdata, msg):
            nonlocal received_data
            try:
                logger.debug(f"Received message on topic {msg.topic}")
                data = json.loads(msg.payload)
                if 'print' in data:  # Only store print data
                    received_data = data['print']  # Store print section
                logger.debug(f"Message data: {data}")
            except Exception as e:
                logger.error(f"Error parsing MQTT message: {e}")
        
        # Create MQTT client
        client = mqtt.Client(protocol=mqtt.MQTTv311)  # Use MQTT 3.1.1
        client.username_pw_set("bblp", printer['accessCode'])
        
        # Enable SSL/TLS
        client.tls_set(cert_reqs=ssl.CERT_NONE)
        client.tls_insecure_set(True)
        
        # Set callbacks
        client.on_connect = on_connect
        client.on_message = on_message
        
        try:
            # Connect to printer MQTT
            logger.info(f"Connecting to printer MQTT at {printer['ip']}")
            client.connect(printer['ip'], 8883, 60)
            
            # Start MQTT loop
            client.loop_start()
            
            # Wait for connection and data
            timeout = time.time() + 5  # 5 seconds timeout
            while not connection_established and time.time() < timeout:
                time.sleep(0.1)
            
            if not connection_established:
                raise Exception("Could not connect to printer MQTT")
            
            # Wait for data
            time.sleep(3)  # Wait a bit longer for data
            
            if not received_data:
                raise Exception("No data received from printer")
                
            # Extract required data
            return {
                "temperatures": {
                    "bed": float(received_data.get('bed_temper', 0)),
                    "nozzle": float(received_data.get('nozzle_temper', 0)),
                    "chamber": float(received_data.get('chamber_temper', 0))
                },
                "status": received_data.get('gcode_state', 'unknown'),
                "progress": float(received_data.get('mc_percent', 0)),
                "remaining_time": int(received_data.get('mc_remaining_time', 0))
            }
                
        finally:
            try:
                client.loop_stop()
                client.disconnect()
            except:
                pass
            
    except Exception as e:
        logger.error(f"Error getting printer status: {str(e)}")
        return {
            "temperatures": {
                "bed": 0,
                "nozzle": 0,
                "chamber": 0
            },
            "status": "offline",
            "progress": 0,
            "remaining_time": 0
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
        ).encode()

        # Erstelle UDP Socket mit Broadcast
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.settimeout(5)  # 5 Sekunden Timeout

        # Bind to all interfaces
        sock.bind(('', 0))

        # Sende an beide Discovery Ports
        discovery_ports = [1990, 2021]
        for port in discovery_ports:
            try:
                logger.info(f"Sending SSDP discovery to port {port}")
                # Sende beide Nachrichten mehrmals für bessere Zuverlässigkeit
                for _ in range(2):
                    sock.sendto(ssdp_request, ('239.255.255.250', port))  # Multicast
                    sock.sendto(ssdp_request, ('255.255.255.255', port))  # Broadcast
                    time.sleep(0.1)  # Kleine Pause zwischen den Versuchen
            except Exception as e:
                logger.error(f"Error sending to port {port}: {e}")

        # Sammle Antworten
        printers = []
        start_time = time.time()
        
        while time.time() - start_time < 5:  # 5 Sekunden warten
            try:
                data, addr = sock.recvfrom(4096)
                response = data.decode()
                logger.debug(f"Received from {addr}: {response}")  # Debug-Level für weniger Spam
                
                # Parse SSDP Response
                if 'bambulab' in response.lower():
                    printer_info = {
                        'id': str(uuid.uuid4()),
                        'ip': addr[0],
                        'type': 'bambulab',
                        'status': 'online'
                    }
                    
                    # Extrahiere Details aus Response
                    for line in response.split('\r\n'):
                        if 'DevName.bambu.com:' in line:
                            printer_info['name'] = line.split(':', 1)[1].strip()
                        elif 'DevModel.bambu.com:' in line:
                            printer_info['model'] = line.split(':', 1)[1].strip()
                        elif 'DevVersion.bambu.com:' in line:
                            printer_info['version'] = line.split(':', 1)[1].strip()
                    
                    # Prüfe ob der Drucker bereits gefunden wurde
                    if not any(p['ip'] == addr[0] for p in printers):
                        printers.append(printer_info)
                        logger.info(f"Found printer: {printer_info}")  # Info-Level für gefundene Drucker
                        
            except socket.timeout:
                continue
            except Exception as e:
                logger.error(f"Error receiving response: {e}")

        logger.info(f"Scan complete. Found {len(printers)} printers")
        return printers

    except Exception as e:
        logger.error(f"Error during network scan: {str(e)}")
        return []
    finally:
        try:
            sock.close()
        except:
            pass

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

def update_printer_order(printer_id, order):
    """Update printer order in database"""
    try:
        printers = getPrinters()
        printer_index = next((i for i, p in enumerate(printers) if p['id'] == printer_id), None)
        
        if printer_index is not None:
            printers[printer_index]['order'] = order
            savePrinters(printers)
            return True
        return False
    except Exception as e:
        logger.error(f"Error updating printer order: {e}")
        return False 