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

class PrinterService:
    def __init__(self):
        self.mqtt_clients = {}
        self.printer_data = {}

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

    def get_printer_status(self, printer_id):
        """Holt den Status aus dem Cache"""
        return self.printer_data.get(printer_id, {})

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

# Globale Instanz des PrinterService
printer_service = PrinterService()

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

def addPrinter(printer_data):
    """Fügt einen neuen Drucker hinzu"""
    try:
        # Generiere eine UUID für den Drucker
        printer_id = str(uuid.uuid4())
        
        # Erstelle den Drucker-Eintrag
        printer = {
            'id': printer_id,
            'name': printer_data['name'],
            'ip': printer_data['ip'],
            'accessCode': printer_data['accessCode'],
            'streamUrl': f"rtsps://bblp:{printer_data['accessCode']}@{printer_data['ip']}:322/streaming/live/1",
            'wsPort': 9000
        }
        
        # Teste die Verbindung zum Drucker
        try:
            # Versuche MQTT-Verbindung
            mqtt_client = printer_service.connect_mqtt(printer_id, printer['ip'])
            mqtt_client.disconnect()
            
            # Wenn wir hier ankommen, war die Verbindung erfolgreich
            stored_printers[printer_id] = printer
            savePrinters()
            
            return {
                'success': True,
                'printer': printer
            }
            
        except Exception as e:
            logger.error(f"Failed to connect to printer: {e}")
            raise ValueError(f"Could not connect to printer at {printer['ip']}: {str(e)}")
            
    except Exception as e:
        logger.error(f"Error adding printer: {e}")
        return {
            'success': False,
            'error': str(e)
        }

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

def getPrinterStatus(printer_id):
    """Holt den Status eines Druckers"""
    try:
        if printer_id not in stored_printers:
            raise ValueError("Printer not found")
            
        printer = stored_printers[printer_id]
        
        # Versuche MQTT-Verbindung
        try:
            mqtt_client = printer_service.connect_mqtt(printer_id, printer['ip'])
            mqtt_client.disconnect()
        except Exception as e:
            return {
                'status': 'error',
                'error': f"Cannot connect to printer: {str(e)}"
            }
            
        return {
            'status': printer.get('status', 'unknown'),
            'temperatures': printer.get('temperatures', {
                'nozzle': 0,
                'bed': 0,
                'chamber': 0
            }),
            'progress': printer.get('progress', 0),
            'remaining_time': printer.get('remaining_time', 0)
        }
        
    except Exception as e:
        logger.error(f"Error getting printer status: {e}")
        return {
            'status': 'error',
            'error': str(e)
        }

def handle_mqtt_message(client, userdata, message):
    try:
        printer_id = message.topic.split('/')[1]
        data = json.loads(message.payload)
        
        if printer_id in stored_printers:
            stored_printers[printer_id].update({
                'status': data.get('print_status', 'unknown'),
                'temperatures': {
                    'nozzle': data.get('temperatures', {}).get('nozzle', 0),
                    'bed': data.get('temperatures', {}).get('bed', 0),
                    'chamber': data.get('temperatures', {}).get('chamber', 0)
                },
                'progress': data.get('progress', 0),
                'remaining_time': data.get('remaining_time', 0),
                'last_update': time.time()
            })
            
            # Prüfe auf wichtige Status-Änderungen für Benachrichtigungen
            if data.get('print_status') in ['completed', 'error', 'cancelled']:
                notification_service.send_notification(
                    printer_id,
                    data.get('print_status'),
                    stored_printers[printer_id]['name']
                )
                
    except Exception as e:
        logger.error(f"Error handling MQTT message: {e}") 

def on_mqtt_message(client, userdata, message):
    try:
        # ... bestehender MQTT Code ...
        
        # Sende Benachrichtigungen bei wichtigen Status-Änderungen
        if status in ['finished', 'failed', 'error']:
            message = create_notification_message(printer, status, data)
            telegram_service.send_notification(message)
            
    except Exception as e:
        logger.error(f"MQTT message error: {e}")

def create_notification_message(printer, status, data):
    """Erstellt formatierte Telegram-Nachricht"""
    icons = {
        'finished': '✅',
        'failed': '❌',
        'error': '⚠️'
    }
    
    status_text = {
        'finished': 'Druck abgeschlossen',
        'failed': 'Druck fehlgeschlagen',
        'error': 'Drucker-Fehler'
    }
    
    message = (
        f"{icons[status]} *{status_text[status]}*\n\n"
        f"🖨 Drucker: `{printer['name']}`\n"
    )
    
    # Füge Druckdetails hinzu wenn verfügbar
    if 'print_stats' in data:
        stats = data['print_stats']
        message += (
            f"📄 Datei: `{stats.get('filename', 'Unbekannt')}`\n"
            f"⏱ Druckzeit: `{format_duration(stats.get('print_duration', 0))}`\n"
            f"🎯 Fortschritt: `{stats.get('progress', 0)*100:.1f}%`\n"
        )
    
    # Füge Temperaturen hinzu wenn verfügbar
    if 'temperatures' in data:
        temps = data['temperatures']
        message += (
            f"\n🌡 *Temperaturen:*\n"
            f"- Düse: `{temps.get('nozzle', 0)}°C`\n"
            f"- Bett: `{temps.get('bed', 0)}°C`\n"
            f"- Kammer: `{temps.get('chamber', 0)}°C`\n"
        )
    
    # Füge Fehlerdetails hinzu wenn vorhanden
    if status in ['failed', 'error'] and 'error' in data:
        message += f"\n⚠️ *Fehler:*\n`{data['error']}`"
    
    return message

def format_duration(seconds):
    """Formatiert Sekunden in lesbare Zeit"""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m" 