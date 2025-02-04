import socket
import json
import logging
import asyncio
import os
from datetime import datetime
import requests

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

        printer_id = f"printer_{ip.replace('.', '_')}_{name.replace(' ', '_')}"
        
        if printer_id in stored_printers:
            return {"success": False, "error": "A printer with this IP and name already exists"}

        if printer_type == 'BAMBULAB':
            access_code = printer_data.get('accessCode')
            if not access_code:
                return {"success": False, "error": "Access code is required for Bambulab printers"}

            # Verwende die alte, funktionierende URL
            stream_url = f"rtsp://bblp:{access_code}@{ip}:8554/live"

            printer = {
                'id': printer_id,
                'name': name,
                'ip': ip,
                'type': 'BAMBULAB',
                'streamUrl': stream_url,
                'accessCode': access_code,
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
    """Holt den Status eines Druckers via Bambulab API"""
    try:
        printer = stored_printers.get(printer_id)
        if not printer:
            return None
            
        # Basis-URL und Headers
        base_url = f"http://{printer['ip']}/api/v1"
        headers = {
            "Authorization": f"Bearer {printer['accessCode']}"
        }
        
        # Hole Print-Job Status
        response = requests.get(f"{base_url}/print-job", headers=headers, timeout=5)
        data = response.json()
        
        # Nur die wichtigsten Daten zurückgeben
        return {
            "temperatures": {
                "bed": data.get("bed_temp", 0),
                "nozzle": data.get("nozzle_temp", 0)
            },
            "printTime": {
                "remaining": data.get("remaining_time", 0)
            },
            "status": data.get("status", "offline"),
            "progress": data.get("progress", 0)
        }
    except Exception as e:
        logger.error(f"Error getting printer status: {e}")
        return None

def startPrint(printer_id, file_path):
    """Startet einen Druck"""
    try:
        printer = stored_printers.get(printer_id)
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
        printer = stored_printers.get(printer_id)
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