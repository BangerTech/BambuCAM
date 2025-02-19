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
import queue
from .networkScanner import scanNetwork
from .mqttService import mqtt_service

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
        self.polling_threads = {}  # Neu hinzugefügt
        self.file_locks = {}

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
                    printer_id = msg.topic.split('/')[1]  # Extract printer ID from topic
                    
                    # Update printer status
                    status_data = {
                        'status': data.get('print', {}).get('gcode_state', 'unknown'),
                        'temperatures': {
                            'hotend': float(data.get('print', {}).get('nozzle_temper', 0)),
                            'bed': float(data.get('print', {}).get('bed_temper', 0)),
                            'chamber': float(data.get('print', {}).get('chamber_temper', 0))
                        },
                        'progress': float(data.get('print', {}).get('mc_percent', 0)),
                        'state': data.get('print', {}).get('gcode_state', 'unknown')
                    }
                    
                    # Cache die Daten
                    self.printer_data[printer_id] = status_data
                    
                    # Update Drucker Status
                    self.update_printer_status(printer_id, status_data)
                    
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
            printer = getPrinterById(printer_id)
            if not printer:
                raise Exception("Printer not found")
            
            if printer['type'] == 'BAMBULAB':
                # Hole Status vom MQTT Service
                mqtt_status = mqtt_service.get_printer_status(printer_id)
                logger.debug(f"MQTT status for {printer_id}: {mqtt_status}")
                
                # Konvertiere in das Format, das das Frontend erwartet
                status = {
                    'printerId': printer_id,
                    'status': mqtt_status.get('status', 'offline').lower(),
                    'temps': {
                        'bed': float(mqtt_status.get('temperatures', {}).get('bed', 0)),
                        'hotend': float(mqtt_status.get('temperatures', {}).get('hotend', 0)),
                        'chamber': float(mqtt_status.get('temperatures', {}).get('chamber', 0))
                    },
                    'targets': {
                        'bed': float(mqtt_status.get('targets', {}).get('bed', 0)),
                        'hotend': float(mqtt_status.get('targets', {}).get('hotend', 0))
                    },
                    'progress': float(mqtt_status.get('progress', 0)),
                    'remaining_time': int(mqtt_status.get('remaining_time', 0))
                }
                
                logger.debug(f"Converted status for frontend: {status}")
                return status
            
            elif printer['type'] == 'CREALITY':
                # Moonraker API Abfrage
                response = requests.get(f"http://{printer['ip']}:7125/printer/objects/query?heater_bed&extruder&temperature_sensor%20chamber_temp", timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    logger.debug(f"Moonraker response: {data}")
                    temps = {
                        'bed': data.get('result', {}).get('status', {}).get('heater_bed', {}).get('temperature', 0),
                        'hotend': data.get('result', {}).get('status', {}).get('extruder', {}).get('temperature', 0),
                        'chamber': data.get('result', {}).get('status', {}).get('temperature_sensor chamber_temp', {}).get('temperature', 0)
                    }
                    
                    return {
                        'status': 'online', 
                        'temperatures': temps,
                        'progress': self.get_print_progress(printer_id)
                    }
            
            else:
                # Existierende Logik für andere Drucker...
                pass

        except Exception as e:
            logger.error(f"Error getting printer status: {e}")
            return {
                'printerId': printer_id,
                'temps': {'hotend': 0, 'bed': 0, 'chamber': 0},
                'targets': {'hotend': 0, 'bed': 0},
                'status': 'offline',
                'progress': 0,
                'remaining_time': 0
            }

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
                self.setup_creality_polling(printer_id, ip)
                    
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

    def setup_creality_polling(self, printer_id: str, printer_ip: str):
        """Richtet Polling für einen Creality K1 Drucker ein"""
        try:
            # Prüfe ob bereits ein Polling-Thread läuft
            if printer_id in self.polling_threads:
                logger.info(f"Polling already active for printer {printer_id}")
                return
            
            def poll_status():
                logger.info(f"Starting polling thread for printer {printer_id}")
                while printer_id in self.polling_threads:
                    try:
                        url = f"http://{printer_ip}:7125/printer/objects/query"
                        params = {
                            "objects": {
                                "extruder": None,
                                "heater_bed": None,
                                "temperature_sensor chamber_temp": None,
                                "print_stats": None,
                                "virtual_sdcard": None
                            }
                        }
                        
                        response = requests.post(url, json=params, timeout=2)
                        
                        if response.ok:
                            data = response.json()
                            status = data.get('result', {}).get('status', {})
                            
                            status_data = {
                                'status': 'online',
                                'temperatures': {
                                    'hotend': status.get('extruder', {}).get('temperature', 0),
                                    'bed': status.get('heater_bed', {}).get('temperature', 0),
                                    'chamber': status.get('temperature_sensor chamber_temp', {}).get('temperature', 0)
                                },
                                'targets': {
                                    'hotend': status.get('extruder', {}).get('target', 0),
                                    'bed': status.get('heater_bed', {}).get('target', 0)
                                },
                                'progress': status.get('virtual_sdcard', {}).get('progress', 0) * 100,
                                'state': status.get('print_stats', {}).get('state', 'standby')
                            }
                            
                            # Cache die Daten
                            self.printer_data[printer_id] = status_data
                            
                            # Update Drucker Status
                            self.update_printer_status(printer_id, status_data)
                        else:
                            logger.warning(f"Error polling printer {printer_id}: {response.status_code}")
                            
                    except requests.exceptions.RequestException as e:
                        logger.error(f"Connection error polling printer {printer_id}: {e}")
                        status_data = {
                            'status': 'error',
                            'temperatures': {'hotend': 0, 'bed': 0, 'chamber': 0},
                            'targets': {'hotend': 0, 'bed': 0},
                            'progress': 0,
                            'state': 'error'
                        }
                        self.printer_data[printer_id] = status_data
                        self.update_printer_status(printer_id, status_data)
                    except Exception as e:
                        logger.error(f"Error in polling thread for {printer_id}: {e}")
                    
                    time.sleep(2)
                logger.info(f"Polling thread stopped for printer {printer_id}")

            # Starte den Thread
            thread = threading.Thread(target=poll_status, daemon=True)
            self.polling_threads[printer_id] = thread
            thread.start()
            logger.info(f"Successfully started polling for Creality printer {printer_id}")

        except Exception as e:
            logger.error(f"Error setting up Creality polling: {e}")
            raise

    def add_printer(self, data: dict) -> dict:
        """Fügt einen neuen Drucker hinzu"""
        try:
            printer_id = str(uuid.uuid4())
            printer = {
                'id': printer_id,
                'name': data['name'],
                'ip': data['ip'],
                'type': data['type'],
                'status': 'offline',
                'temperatures': {
                    'hotend': 0,
                    'bed': 0,
                    'chamber': 0
                },
                'progress': 0,
                'port': 8554,
                'accessCode': data['accessCode'],
                'streamUrl': f"rtsps://bblp:{data['accessCode']}@{data['ip']}:322/streaming/live/1"
            }
            
            # Get MQTT info and store serial number
            if data['type'] == 'BAMBULAB':
                try:
                    mqtt_info = self.mqtt_service.get_printer_mqtt_info(data['ip'])
                    if mqtt_info and mqtt_info.get('sn'):
                        printer['serial'] = mqtt_info['sn']
                except Exception as e:
                    logger.error(f"Error getting MQTT info: {e}")
            
            self.save_printer(printer)
            return printer
        except Exception as e:
            logger.error(f"Error adding printer: {e}")
            raise

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
                'hotend': 0,
                'bed': 0,
                'chamber': 0
            },
            'progress': 0,
            'port': getNextPort()
        }

        # Spezifische Konfiguration je nach Druckertyp
        if printer['type'] == 'BAMBULAB':
            printer.update({
                'accessCode': data.get('accessCode', ''),
                'streamUrl': f"rtsps://bblp:{data['accessCode']}@{data['ip']}:322/streaming/live/1"
            })
            
            # MQTT Verbindung für Bambulab Drucker
            mqtt_service.connect_printer(
                printer_id=printer['id'],
                ip=printer['ip'],
                access_code=printer['accessCode']
            )
            
        elif printer['type'] == 'CREALITY':
            printer.update({
                'accessCode': '',  # Creality braucht keinen Access Code
                'streamUrl': f"http://{data['ip']}:8080/?action=stream"  # Standard MJPEG Stream URL
            })
            
            # Starte Polling für Creality direkt über die PrinterService-Instanz
            printer_service.connect_printer(printer['id'], 'CREALITY', printer['ip'])
        
        printer_file = os.path.join(PRINTERS_DIR, f"{printer['id']}.json")
        logger.info(f"Saving printer to file: {printer_file}")
        
        with open(printer_file, 'w') as f:
            json.dump(printer, f, indent=2)
            
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
    """Entfernt einen Drucker"""
    try:
        printer = getPrinterById(printer_id)
        if not printer:
            return False
            
        # Cleanup MQTT wenn es ein Bambulab Drucker ist
        if printer['type'] == 'BAMBULAB':
            mqtt_service.disconnect_printer(printer_id)
        elif printer['type'] == 'CREALITY':
            # ... existierender Creality Cleanup Code ...
            printer_service.cleanup(printer_id)
            
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
        logger.error(f"Error removing printer: {e}")
        return False

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
        printer_id = msg.topic.split('/')[1]  # Extract printer ID from topic
        
        # Update printer status
        status_data = {
            'status': data.get('print', {}).get('gcode_state', 'unknown'),
            'temperatures': {
                'hotend': float(data.get('print', {}).get('nozzle_temper', 0)),
                'bed': float(data.get('print', {}).get('bed_temper', 0)),
                'chamber': float(data.get('print', {}).get('chamber_temper', 0))
            },
            'progress': float(data.get('print', {}).get('mc_percent', 0)),
            'state': data.get('print', {}).get('gcode_state', 'unknown')
        }
        
        # Cache die Daten
        self.printer_data[printer_id] = status_data
        
        # Update Drucker Status
        self.update_printer_status(printer_id, status_data)
        
    except Exception as e:
        logger.error(f"Error processing MQTT message: {e}")

# Lade gespeicherte Drucker beim Start
stored_printers = getPrinters()

def getPrinterStatus(printer_id):
    """Holt den Status eines Druckers"""
    try:
        printer = getPrinterById(printer_id)
        if not printer:
            raise Exception("Printer not found")
            
        if printer['type'] == 'BAMBULAB':
            # Hole Status über MQTT Service
            return mqtt_service.get_printer_status(printer_id)
        elif printer['type'] == 'CREALITY':
            # Moonraker API Abfrage
            response = requests.get(f"http://{printer['ip']}:7125/printer/objects/query?heater_bed&extruder&temperature_sensor%20chamber_temp", timeout=5)
            if response.status_code == 200:
                data = response.json()
                logger.debug(f"Moonraker response: {data}")
                temps = {
                    'bed': data.get('result', {}).get('status', {}).get('heater_bed', {}).get('temperature', 0),
                    'hotend': data.get('result', {}).get('status', {}).get('extruder', {}).get('temperature', 0),
                    'chamber': data.get('result', {}).get('status', {}).get('temperature_sensor chamber_temp', {}).get('temperature', 0)
                }
                
                return {
                    'status': 'online', 
                    'temperatures': temps,
                    'progress': self.get_print_progress(printer_id)
                }
            
    except Exception as e:
        logger.error(f"Error getting printer status: {e}")
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
                    'hotend': data.get('nozzle_temp', 0)
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