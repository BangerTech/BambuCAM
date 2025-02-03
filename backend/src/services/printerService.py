import socket
import json
import paho.mqtt.client as mqtt
from datetime import datetime

# Bambu Lab Ports
MQTT_PORT = 8883  # Bambu Lab verwendet Port 8883 für MQTT
DISCOVERY_PORT = 8991  # Bambu Lab Discovery Port

# Globale Variable für gespeicherte Drucker
stored_printers = {}

# MQTT Callbacks
def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")

def on_message(client, userdata, msg):
    print(f"Message received on {msg.topic}: {msg.payload}")

def addPrinter(printer_data):
    """Fügt einen neuen Drucker hinzu"""
    # Generiere eine eindeutige ID basierend auf IP und Name
    printer_id = f"printer_{printer_data['ip'].replace('.', '_')}_{printer_data['name'].replace(' ', '_')}"
    
    # Prüfe ob ein Drucker mit dieser IP und diesem Namen bereits existiert
    for existing_id, existing_printer in stored_printers.items():
        if (existing_printer['ip'] == printer_data['ip'] and 
            existing_printer['name'] == printer_data['name']):
            return existing_printer
    
    # Füge neuen Drucker hinzu
    stored_printers[printer_id] = {
        "id": printer_id,
        "name": printer_data['name'],
        "ip": printer_data['ip'],
        "type": "bambulab",
        "status": "online",
        "streamUrl": printer_data.get('streamUrl'),
        "accessCode": printer_data['accessCode'],
        "wsPort": printer_data.get('wsPort', 9000)
    }
    return stored_printers[printer_id]

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