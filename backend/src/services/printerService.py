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
from src.printer_types import PRINTER_CONFIGS
import threading
import struct

# Logger konfigurieren
logger = logging.getLogger(__name__)

# Bambu Lab Ports
MQTT_PORT = 8883
DISCOVERY_PORT = 1990
SSDP_PORT = 2021
RTSP_PORT = 322

# Globale Variable für gespeicherte Drucker
stored_printers = {}

# Definiere Basis-Verzeichnis (das Backend-Verzeichnis)
BASE_DIR = Path(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
DATA_DIR = BASE_DIR / 'data'
PRINTERS_DIR = DATA_DIR / 'printers'
STREAMS_DIR = DATA_DIR / 'streams'

# Stelle sicher, dass die Verzeichnisse existieren
os.makedirs(PRINTERS_DIR, exist_ok=True)
os.makedirs(STREAMS_DIR, exist_ok=True)

# Ändere die Konfiguration am Anfang der Datei
PRINTERS_FILE = Path(os.getenv('PRINTERS_FILE', 'printers.json'))

def getNextPort() -> int:
    """
    Findet den nächsten freien Port für einen neuen Drucker.
    Startet bei 8554 und erhöht um 1 bis ein freier Port gefunden wird.
    """
    try:
        used_ports = []
        
        # Durchsuche alle Drucker-Dateien
        for printer_file in os.listdir(PRINTERS_DIR):
            if printer_file.endswith('.json'):
                with open(os.path.join(PRINTERS_DIR, printer_file), 'r') as f:
                    printer = json.load(f)
                    used_ports.append(printer.get('port', 0))
                    
        if not used_ports:
            return 8554  # Startport wenn keine Drucker existieren
        return max(used_ports) + 1
    except FileNotFoundError:
        return 8554  # Startport wenn Verzeichnis nicht existiert
    except json.JSONDecodeError:
        return 8554  # Startport wenn JSON ungültig

class PrinterService:
    def __init__(self):
        self.mqtt_clients = {}
        self.printer_data = {}
        self.file_locks = {}  # Locks für jede Drucker-Datei

    def get_file_lock(self, printer_id):
        """Holt oder erstellt einen Lock für einen Drucker"""
        if printer_id not in self.file_locks:
            self.file_locks[printer_id] = threading.Lock()
        return self.file_locks[printer_id]

    def connect_mqtt(self, printer_id, ip):
        """Erstellt eine persistente MQTT Verbindung"""
        try:
            printer = getPrinterById(printer_id)
            if not printer:
                logger.error(f"Printer {printer_id} not found")
                raise Exception("Printer not found")

            if printer_id in self.mqtt_clients:
                if self.mqtt_clients[printer_id].is_connected():
                    return
                self.mqtt_clients[printer_id].disconnect()
            
            client = mqtt.Client()
            
            # SSL Konfiguration
            client.tls_set(certfile=None, keyfile=None, cert_reqs=ssl.CERT_NONE)
            client.tls_insecure_set(True)
            
            # Setze Credentials
            client.username_pw_set("bblp", printer['accessCode'])
            
            def on_connect(client, userdata, flags, rc):
                rc_codes = {
                    0: "Connection successful",
                    1: "Incorrect protocol version",
                    2: "Invalid client identifier",
                    3: "Server unavailable",
                    4: "Bad username or password",
                    5: "Not authorized"
                }
                logger.info(f"MQTT Connect result: {rc_codes.get(rc, f'Unknown error {rc}')}")
                if rc == 0:
                    client.subscribe("device/+/report")

            def on_message(client, userdata, msg):
                try:
                    data = json.loads(msg.payload)
                    self.printer_data[printer_id] = data
                    # Update printer status
                    self.update_printer_status(printer_id, {
                        'status': data.get('print', {}).get('gcode_state', 'unknown'),
                        'temperatures': {
                            'nozzle': data.get('print', {}).get('nozzle_temper', 0),
                            'bed': data.get('print', {}).get('bed_temper', 0)
                        },
                        'progress': data.get('print', {}).get('mc_percent', 0),
                        'state': data.get('print', {}).get('gcode_state', 'unknown')
                    })
                except Exception as e:
                    logger.error(f"Error processing MQTT message: {e}")

            client.on_connect = on_connect
            client.on_message = on_message
            
            # Verbinde mit Port 8883
            client.connect(ip, 8883, 60)
            client.loop_start()
            self.mqtt_clients[printer_id] = client

        except Exception as e:
            logger.error(f"Error connecting to MQTT: {e}")
            raise

    def get_printer_status(self, printer_id: str) -> dict:
        """Holt den Status eines Druckers"""
        try:
            # Lade Drucker-Daten
            printer_file = os.path.join(PRINTERS_DIR, f"{printer_id}.json")
            if not os.path.exists(printer_file):
                logger.error(f"Printer file not found: {printer_file}")
                return {'error': 'Printer not found'}

            try:
                with open(printer_file, 'r') as f:
                    printer = json.load(f)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON in printer file: {printer_file}")
                return {'error': 'Invalid printer data'}

            # Prüfe ob alle notwendigen Felder vorhanden sind
            required_fields = ['type', 'ip']
            for field in required_fields:
                if field not in printer:
                    logger.error(f"Missing required field '{field}' in printer data")
                    return {'error': f'Missing {field}'}

            # Hole Status basierend auf Druckertyp
            if printer['type'] == 'CREALITY':
                try:
                    url = f"http://{printer['ip']}/printer/info"
                    response = requests.get(url, timeout=2)
                    
                    if response.ok:
                        data = response.json()
                        return {
                            'status': 'online',
                            'temperatures': {
                                'nozzle': data.get('nozzle_temp', 0),
                                'bed': data.get('bed_temp', 0)
                            },
                            'targets': {
                                'nozzle': data.get('nozzle_target', 0),
                                'bed': data.get('bed_target', 0)
                            },
                            'progress': data.get('progress', 0),
                            'state': data.get('status', 'unknown')
                        }
                except Exception as e:
                    logger.error(f"Error getting Creality status: {e}")
                    return {
                        'status': 'error',
                        'temperatures': {'nozzle': 0, 'bed': 0},
                        'targets': {'nozzle': 0, 'bed': 0},
                        'progress': 0,
                        'state': 'error'
                    }

            return {
                'status': 'offline',
                'temperatures': {'nozzle': 0, 'bed': 0},
                'targets': {'nozzle': 0, 'bed': 0},
                'progress': 0,
                'state': 'offline'
            }

        except Exception as e:
            logger.error(f"Error getting printer status: {e}", exc_info=True)
            return {'error': str(e)}

    def cleanup(self, printer_id=None):
        """Beendet MQTT Verbindungen"""
        if printer_id:
            if printer_id in self.mqtt_clients:
                self.mqtt_clients[printer_id].disconnect()
                del self.mqtt_clients[printer_id]
                del self.printer_data[printer_id]
        else:
            # Cleanup alle Verbindungen
            for client in self.mqtt_clients.values():
                client.disconnect()
            self.mqtt_clients.clear()
            self.printer_data.clear()

    def connect_printer(self, printer_id: str, printer_type: str, ip: str):
        """Verbindet einen Drucker basierend auf seinem Typ"""
        try:
            logger.info(f"Connecting printer {printer_id} of type {printer_type} at IP {ip}")
            
            # Prüfe ob bereits eine Verbindung besteht
            if printer_id in self.mqtt_clients:
                if isinstance(self.mqtt_clients[printer_id], mqtt.Client) and self.mqtt_clients[printer_id].is_connected():
                    logger.info(f"Printer {printer_id} already connected")
                    return
                # Cleanup alte Verbindung
                if isinstance(self.mqtt_clients[printer_id], mqtt.Client):
                    self.mqtt_clients[printer_id].disconnect()
                del self.mqtt_clients[printer_id]
                
            # Verbinde basierend auf Drucker-Typ
            if printer_type.upper() == 'BAMBULAB':
                self.connect_mqtt(printer_id, ip)
            elif printer_type.upper() == 'CREALITY':
                logger.info(f"Setting up Creality polling for printer {printer_id}")
                polling_thread = setup_creality_polling(printer_id, ip)
                if polling_thread:
                    self.mqtt_clients[printer_id] = polling_thread
                    logger.info(f"Successfully started polling for Creality printer {printer_id}")
                else:
                    logger.error(f"Failed to start polling for Creality printer {printer_id}")
                    
        except Exception as e:
            logger.error(f"Error connecting printer {printer_id}: {e}", exc_info=True)

    def update_printer_status(self, printer_id: str, status_data: dict) -> None:
        """Aktualisiert den Status eines Druckers."""
        try:
            printer_file = os.path.join(PRINTERS_DIR, f"{printer_id}.json")
            
            # Hole Lock für diesen Drucker
            lock = self.get_file_lock(printer_id)
            
            with lock:  # Thread-sicheres Lesen/Schreiben
                if not os.path.exists(printer_file) or os.path.getsize(printer_file) == 0:
                    logger.debug(f"Skipping status update for removed printer: {printer_id}")
                    return
                    
                try:
                    with open(printer_file, 'r') as f:
                        printer_data = json.load(f)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in printer file: {printer_file}")
                    return
                    
                # Update alle Status-Felder
                printer_data.update({
                    'status': status_data.get('status', printer_data.get('status')),
                    'temperatures': status_data.get('temperatures', printer_data.get('temperatures', {})),
                    'targets': status_data.get('targets', printer_data.get('targets', {})),
                    'power': status_data.get('power', printer_data.get('power', {})),
                    'progress': status_data.get('progress', printer_data.get('progress', 0)),
                    'is_active': status_data.get('is_active', printer_data.get('is_active', False)),
                    'layer': status_data.get('layer', printer_data.get('layer', {'current': 0, 'total': 0})),
                    'filename': status_data.get('filename', printer_data.get('filename', '')),
                    'state': status_data.get('state', printer_data.get('state', 'offline')),
                    'print_duration': status_data.get('print_duration', printer_data.get('print_duration', 0)),
                    'message': status_data.get('message', printer_data.get('message', ''))
                })
                
                # Direkte Speicherung mit Lock
                with open(printer_file, 'w') as f:
                    json.dump(printer_data, f, indent=2)
                    
                logger.debug('Updated status for printer %s', printer_id)
                
        except Exception as e:
            logger.error(f"Error updating printer status: {e}", exc_info=True)

# Globale Instanz des PrinterService
printer_service = PrinterService()

async def test_stream_url(url, printer_type='BAMBULAB'):
    """Testet ob eine Stream-URL erreichbar ist"""
    try:
        command = ['ffmpeg']
        
        # Füge typ-spezifische Optionen hinzu
        if printer_type in PRINTER_CONFIGS:
            command.extend(PRINTER_CONFIGS[printer_type]['ffmpeg_options'])
        
        command.extend([
            '-i', url,
            '-t', '1',
            '-f', 'null',
            '-'
        ])
        
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

def addPrinter(data):
    """Fügt einen neuen Drucker hinzu"""
    try:
        logger.info(f"Adding printer with data: {data}")
        
        printer = {
            'id': str(uuid.uuid4()),
            'name': data['name'],
            'ip': data['ip'],
            'type': data.get('type', 'BAMBULAB'),
            'status': 'offline',
            'temperatures': {
                'nozzle': 0,
                'bed': 0
            },
            'progress': 0,
            'port': getNextPort(),
            'accessCode': data.get('accessCode', ''),
            'streamUrl': f"rtsps://bblp:{data['accessCode']}@{data['ip']}:322/streaming/live/1"
        }
        
        printer_file = os.path.join(PRINTERS_DIR, f"{printer['id']}.json")
        logger.info(f"Saving printer to file: {printer_file}")
        
        with open(printer_file, 'w') as f:
            json.dump(printer, f, indent=2)
            
        # MQTT-Verbindung einrichten
        printer_service.connect_printer(
            printer_id=printer['id'],
            printer_type=printer['type'],
            ip=printer['ip']
        )
            
        return printer
        
    except Exception as e:
        logger.error(f"Error adding printer: {e}", exc_info=True)
        raise

def getPrinters():
    """Lädt alle Drucker aus den einzelnen JSON-Dateien"""
    printers = []
    
    try:
        # Stelle sicher, dass das Verzeichnis existiert
        os.makedirs(PRINTERS_DIR, exist_ok=True)
        
        logger.info(f"Loading printers from directory: {PRINTERS_DIR}")
        
        # Lade jeden Drucker aus seiner JSON-Datei
        for printer_file in os.listdir(PRINTERS_DIR):
            if printer_file.endswith('.json'):
                file_path = PRINTERS_DIR / printer_file
                try:
                    with open(file_path, 'r') as f:
                        printer = json.load(f)
                        printers.append(printer)
                        logger.debug(f"Loaded printer: {printer.get('name')} from {file_path}")
                except Exception as e:
                    logger.error(f"Error loading printer from {file_path}: {e}")
                    continue
                    
        logger.info(f"Successfully loaded {len(printers)} printers")
        return printers
    except Exception as e:
        logger.error(f"Error getting printers: {e}", exc_info=True)
        return []

def getPrinterById(printer_id):
    """Lädt einen spezifischen Drucker aus seiner JSON-Datei"""
    try:
        printer_file = PRINTERS_DIR / f"{printer_id}.json"
        with open(printer_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except Exception as e:
        logger.error(f"Error getting printer {printer_id}: {e}")
        return None

def removePrinter(printer_id):
    """Löscht einen Drucker und seine Stream-Daten"""
    try:
        # Lösche Drucker-Datei
        printer_file = PRINTERS_DIR / f"{printer_id}.json"
        try:
            os.remove(printer_file)
        except FileNotFoundError:
            pass

        # Lösche zugehörige Stream-Datei falls vorhanden
        stream_file = STREAMS_DIR / f"{printer_id}.json"
        try:
            os.remove(stream_file)
        except FileNotFoundError:
            pass

        return True
    except Exception as e:
        logger.error(f"Error removing printer {printer_id}: {e}")
        return False

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
                
                # Parse SSDP Response
                if 'bambulab' in response.lower():
                    printer_info = {
                        'id': str(uuid.uuid4()),
                        'ip': addr[0],
                        'type': 'BAMBULAB',
                        'status': 'online'
                    }
                    
                    # Extrahiere Details aus Response
                    for line in response.split('\r\n'):
                        if 'DevName.bambu.com:' in line:
                            printer_info['name'] = line.split(':', 1)[1].strip()
                        elif 'DevModel.bambu.com:' in line:
                            printer_info['model'] = line.split(':', 1)[1].strip()
                    
                    # Prüfe ob der Drucker bereits gefunden wurde
                    if not any(p['ip'] == addr[0] for p in printers):
                        printers.append(printer_info)
                        logger.info(f"Found printer: {printer_info}")
                        
            except socket.timeout:
                continue
            except Exception as e:
                logger.error(f"Error receiving response: {e}")

        logger.info(f"Scan complete. Found {len(printers)} printers")
        return {'printers': printers}

    except Exception as e:
        logger.error(f"Error during network scan: {str(e)}")
        return {'printers': []}
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
    try:
        data = json.loads(msg.payload)
        self.printer_data[printer_id] = data
        # Update printer status
        self.update_printer_status(printer_id, {
            'status': data.get('print', {}).get('gcode_state', 'unknown'),
            'temperatures': {
                'nozzle': data.get('print', {}).get('nozzle_temper', 0),
                'bed': data.get('print', {}).get('bed_temper', 0)
            },
            'progress': data.get('print', {}).get('mc_percent', 0),
            'state': data.get('print', {}).get('gcode_state', 'unknown')
        })
    except Exception as e:
        logger.error(f"Error processing MQTT message: {e}")

# Lade gespeicherte Drucker beim Start
stored_printers = getPrinters()

def getPrinterStatus(printer_id):
    """Gets the printer status using MQTT"""
    try:
        printer = getPrinterById(printer_id)
        if not printer:
            raise Exception("Printer not found")
            
        # Stelle sicher dass eine MQTT Verbindung besteht
        printer_service.connect_mqtt(printer_id, printer['ip'])
        
        # Hole Status aus dem Cache
        data = printer_service.get_printer_status(printer_id)
        
        # Extrahiere die benötigten Daten
        if 'print' in data:
            print_data = data['print']
            return {
                "temperatures": {
                    "bed": float(print_data.get('bed_temper', 0)),
                    "nozzle": float(print_data.get('nozzle_temper', 0)),
                    "chamber": float(print_data.get('chamber_temper', 0))
                },
                "status": print_data.get('gcode_state', 'unknown'),
                "progress": float(print_data.get('mc_percent', 0)),
                "remaining_time": int(print_data.get('mc_remaining_time', 0))
            }
        
        return {
            "temperatures": {"bed": 0, "nozzle": 0, "chamber": 0},
            "status": "offline",
            "progress": 0,
            "remaining_time": 0
        }
                
    except Exception as e:
        logger.error(f"Error getting printer status: {str(e)}")
        return {
            "temperatures": {"bed": 0, "nozzle": 0, "chamber": 0},
            "status": "offline",
            "progress": 0,
            "remaining_time": 0
        }

def handle_mqtt_message(printer_id, data):
    """Verarbeitet MQTT Nachrichten und sendet ggf. Benachrichtigungen"""
    try:
        if printer_id not in stored_printers:
            return
            
        # Update Drucker Status
        stored_printers[printer_id].update({
            'status': {
                'print_status': data.get('print_status'),
                'gcode_state': data.get('gcode_state'),
                'temperature': {
                    'bed': data.get('bed_temp', 0),
                    'nozzle': data.get('nozzle_temp', 0)
                },
                'progress': data.get('progress', 0),
                'remaining_time': data.get('remaining_time', 0),
                'last_update': time.time()
            }
        })
        
        # Prüfe auf wichtige Status-Änderungen für Benachrichtigungen
        gcode_state = data.get('gcode_state', '').lower()
        
        # Status-spezifische Emojis und Nachrichten
        status_messages = {
            'finish': '✅ Druck erfolgreich beendet',
            'failed': '❌ Druck-Fehler aufgetreten',
            'stopped': '⚠️ Druck abgebrochen',
            'running': None  # Keine Nachricht für laufende Drucke
        }
        
        if gcode_state in status_messages and status_messages[gcode_state]:
            printer_name = stored_printers[printer_id]['name']
            message = f"{status_messages[gcode_state]}\n*Drucker:* {printer_name}"
            
            # Sende Benachrichtigung über Telegram
            telegram_service.send_notification(message)
            logger.info(f"Sending notification for state {gcode_state}: {message}")
            
    except Exception as e:
        logger.error(f"Error handling MQTT message: {e}")

def setup_creality_polling(printer_id: str, printer_ip: str):
    """Richtet Polling für einen Creality K1 Drucker ein"""
    try:
        def poll_status():
            while True:
                try:
                    status = get_creality_status(printer_ip)
                    printer_service.update_printer_status(printer_id, status)
                    time.sleep(2)  # Poll alle 2 Sekunden
                except Exception as e:
                    logger.error(f"Error polling printer status: {e}")
                    time.sleep(5)  # Längere Pause bei Fehler
        
        # Starte Polling in eigenem Thread
        polling_thread = threading.Thread(target=poll_status, daemon=True)
        polling_thread.start()
        
        return polling_thread
        
    except Exception as e:
        logger.error(f"Error setting up status polling: {e}")
        return None

def get_creality_status(printer_ip: str) -> dict:
    try:
        url = f"http://{printer_ip}:7125/printer/objects/query"
        params = {
            "objects": {
                "extruder": None,
                "heater_bed": None,
                "temperature_sensor chamber": None,
                "print_stats": None,
                "virtual_sdcard": None
            }
        }
        
        response = requests.post(url, json=params, timeout=2)
        
        if response.ok:
            data = response.json()
            status = data.get('result', {}).get('status', {})
            
            result = {
                'status': 'online',
                'temperatures': {
                    'hotend': status.get('extruder', {}).get('temperature', 0),
                    'bed': status.get('heater_bed', {}).get('temperature', 0),
                    'chamber': status.get('temperature_sensor chamber', {}).get('temperature', 0)
                },
                'targets': {
                    'hotend': status.get('extruder', {}).get('target', 0),
                    'bed': status.get('heater_bed', {}).get('target', 0)
                },
                'progress': status.get('virtual_sdcard', {}).get('progress', 0) * 100,
                'state': status.get('print_stats', {}).get('state', 'offline')
            }
            
            return result
            
        return {
            'status': 'offline',
            'temperatures': {'hotend': 0, 'bed': 0, 'chamber': 0},
            'targets': {'hotend': 0, 'bed': 0},
            'progress': 0,
            'state': 'offline'
        }
    except Exception as e:
        logger.error(f"Error getting Creality status: {e}")
        return {
            'status': 'error',
            'temperatures': {'hotend': 0, 'bed': 0, 'chamber': 0},
            'targets': {'hotend': 0, 'bed': 0},
            'progress': 0,
            'state': 'error'
        }

def parse_ssdp_response(response, ip):
    """Extrahiert Drucker-Informationen aus der SSDP-Antwort"""
    try:
        printer_info = {
            'id': str(uuid.uuid4()),
            'ip': ip,
            'type': 'BAMBULAB',
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
                
        # Prüfe ob alle notwendigen Informationen vorhanden sind
        if 'name' not in printer_info:
            printer_info['name'] = f"Bambu Lab Printer ({ip})"
            
        logger.debug(f"Parsed printer info: {printer_info}")
        return printer_info
        
    except Exception as e:
        logger.error(f"Error parsing SSDP response: {e}")
        return None 