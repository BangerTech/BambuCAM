import socket
import json
import logging
import asyncio
import os
from datetime import datetime

# Logger konfigurieren
logger = logging.getLogger(__name__)

# Bambu Lab Ports
MQTT_PORT = 8883
DISCOVERY_PORT = 8991

# Globale Variable für gespeicherte Drucker
stored_printers = {}

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
        
        # Neue Event Loop für jeden Test
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
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
        finally:
            loop.close()
            
    except Exception as e:
        logger.debug(f"Error testing stream URL {url}: {e}")
        return False

def addPrinter(printer_data):
    """Fügt einen neuen Drucker hinzu"""
    try:
        printer_type = printer_data.get('type', 'BAMBULAB').upper()
        ip = printer_data.get('ip', '')
        name = printer_data.get('name', '')
        
        if not ip:
            return {"success": False, "error": "IP address is required"}
        if not name:
            return {"success": False, "error": "Name is required"}

        # Generiere eine eindeutige ID
        printer_id = f"printer_{ip.replace('.', '_')}_{name.replace(' ', '_')}"
        
        # Prüfe ob ein Drucker mit dieser ID bereits existiert
        if printer_id in stored_printers:
            return {"success": False, "error": "A printer with this IP and name already exists"}

        if printer_type == 'BAMBULAB':
            access_code = printer_data.get('accessCode')
            if not access_code:
                return {"success": False, "error": "Access code is required for Bambulab printers"}

            # Teste beide möglichen Stream-URLs
            stream_urls = [
                f"rtsp://bblp:{access_code}@{ip}:8554/live",  # Alt (ungesichert)
                f"rtsps://bblp:{access_code}@{ip}:322/streaming/live/1"  # Neu (SSL)
            ]
            
            working_url = None
            for url in stream_urls:
                if asyncio.run(test_stream_url(url)):
                    working_url = url
                    logger.info(f"Found working stream URL: {url}")
                    break
            
            if not working_url:
                logger.warning("No working stream URL found, using default")
                working_url = stream_urls[1]  # Fallback zur neuen URL
                
            printer = {
                'id': printer_id,
                'name': printer_data.get('name', f'Bambulab ({ip})'),
                'ip': ip,
                'type': 'BAMBULAB',  # Wichtig: Konsistenter Typ
                'streamUrl': working_url,
                'accessCode': access_code,
                'apiUrl': f"http://{ip}:80/api/v1",
                'wsPort': printer_data.get('wsPort', 9000),
                'status': 'online',
                'added': datetime.now().isoformat()
            }

        elif printer_type == 'CREALITY_K1':
            printer = {
                'id': printer_id,
                'name': printer_data.get('name', f'K1 ({ip})'),
                'ip': ip,
                'type': 'CREALITY_K1',
                'streamUrl': f"http://{ip}:4408/webcam/?action=stream",
                'apiUrl': f"http://{ip}:7125/printer/objects/query",
                'wsPort': printer_data.get('wsPort', 9000),
                'status': 'online',
                'added': datetime.now().isoformat()
            }
        else:
            return {"success": False, "error": "Invalid printer type"}

        # Speichere Drucker
        stored_printers[printer_id] = printer
        savePrinters()
        
        return {
            "success": True,
            "printer": printer  # Enthält die ID
        }

    except Exception as e:
        logger.error(f"Error adding printer: {e}")
        return {"success": False, "error": str(e)}

def savePrinters():
    """Speichert die Drucker in einer JSON-Datei"""
    try:
        with open('printers.json', 'w') as f:
            json.dump(stored_printers, f)
        return True
    except Exception as e:
        logger.error(f"Error saving printers: {e}")
        return False

def loadPrinters():
    """Lädt die Drucker aus der JSON-Datei"""
    global stored_printers
    try:
        if os.path.exists('printers.json'):
            with open('printers.json', 'r') as f:
                stored_printers = json.load(f)
    except Exception as e:
        logger.error(f"Error loading printers: {e}")
        stored_printers = {}

# MQTT Callbacks
def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")

def on_message(client, userdata, msg):
    print(f"Message received on {msg.topic}: {msg.payload}")

def getPrinters():
    """Gibt alle gespeicherten Drucker zurück"""
    return list(stored_printers.values())

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

def getPrinterStatus(printer_id):
    """Holt den Status eines Druckers"""
    try:
        printers = scanNetwork()
        for printer in printers:
            if printer["id"] == printer_id:
                return printer
        return None
    except Exception as e:
        print(f"Error getting printer status: {str(e)}")
        return None

def removePrinter(printer_id):
    """Entfernt einen Drucker"""
    try:
        if printer_id in stored_printers:
            del stored_printers[printer_id]
            savePrinters()  # Speichere die aktualisierte Liste
            return True
        return False
    except Exception as e:
        logger.error(f"Error removing printer: {e}")
        return False

# Lade gespeicherte Drucker beim Start
loadPrinters() 