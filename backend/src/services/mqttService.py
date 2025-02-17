import paho.mqtt.client as mqtt
import json
import logging
import ssl
from datetime import datetime
from .notificationService import send_printer_notification
from pathlib import Path
import os

logger = logging.getLogger(__name__)

# Bambu Lab Ports
MQTT_PORT = 8883
DISCOVERY_PORT = 1990
SSDP_PORT = 2021
RTSP_PORT = 322

# Pfad zur JSON-Datei
PRINTERS_FILE = Path(os.getenv('PRINTERS_FILE', 'printers.json'))

class MQTTService:
    def __init__(self):
        self.clients = {}
        self.printer_data = {}
        self.stored_printers = {}

    def connect_printer(self, printer_id: str, ip: str, access_code: str):
        """Verbindet einen Bambulab Drucker über MQTT"""
        try:
            logger.info(f"Connecting MQTT for Bambulab printer {printer_id} at {ip}")
            
            # Cleanup existierende Verbindung falls vorhanden
            if printer_id in self.clients:
                if self.clients[printer_id].is_connected():
                    logger.info(f"Printer {printer_id} already connected")
                    return
                self.clients[printer_id].disconnect()
                del self.clients[printer_id]

            # Erstelle neuen MQTT Client
            client = mqtt.Client()
            
            # SSL Konfiguration für Bambulab
            client.tls_set(certfile=None, keyfile=None, cert_reqs=ssl.CERT_NONE)
            client.tls_insecure_set(True)
            
            # Setze Credentials
            client.username_pw_set("bblp", access_code)

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
                    # Subscribe zu mehreren Topics
                    topics = [
                        ("device/+/report", 0),
                        ("device/+/status", 0),
                        ("device/+/push", 0)
                    ]
                    client.subscribe(topics)
                    logger.info(f"Subscribed to topics: {[t[0] for t in topics]}")

            def on_message(client, userdata, msg):
                try:
                    logger.debug(f"Received MQTT message on topic {msg.topic}")
                    # Extrahiere printer_id aus dem Topic (format: device/PRINTER_ID/report)
                    topic_parts = msg.topic.split('/')
                    if len(topic_parts) >= 3:
                        message_printer_id = topic_parts[1]
                        logger.debug(f"Message for printer: {message_printer_id}")
                        
                        data = json.loads(msg.payload)
                        if 'print' in data:
                            print_data = data['print']
                            status_data = {
                                "temperatures": {
                                    "bed": float(print_data.get('bed_temper', 0)),
                                    "nozzle": float(print_data.get('nozzle_temper', 0)),
                                    "chamber": float(print_data.get('chamber_temper', 0))
                                },
                                "targets": {
                                    "bed": float(print_data.get('bed_target_temper', 0)),
                                    "nozzle": float(print_data.get('nozzle_target_temper', 0))
                                },
                                "status": print_data.get('gcode_state', 'unknown'),
                                "progress": float(print_data.get('mc_percent', 0)),
                                "remaining_time": int(print_data.get('mc_remaining_time', 0))
                            }
                            
                            logger.info(f"Processed status data: {status_data}")
                            
                            # Speichere die verarbeiteten Daten
                            self.printer_data[printer_id] = status_data
                            
                            # Update stored_printers Status
                            if printer_id in self.stored_printers:
                                self.stored_printers[printer_id].update({
                                    'status': status_data['status'],
                                    'temperatures': status_data['temperatures'],
                                    'targets': status_data['targets'],
                                    'progress': status_data['progress'],
                                    'remaining_time': status_data['remaining_time'],
                                    'last_update': datetime.now().timestamp()
                                })
                                
                                # Sende Benachrichtigung bei Statusänderungen
                                self._check_status_change(printer_id, print_data)
                
                except Exception as e:
                    logger.error(f"Error processing MQTT message: {e}")

            client.on_connect = on_connect
            client.on_message = on_message
            
            # Verbinde mit Bambulab MQTT Port
            client.connect(ip, MQTT_PORT, 60)
            client.loop_start()
            
            self.clients[printer_id] = client
            logger.info(f"Successfully connected MQTT for printer {printer_id}")
            
        except Exception as e:
            logger.error(f"Error connecting MQTT for printer {printer_id}: {e}", exc_info=True)
            raise

    def get_printer_status(self, printer_id: str) -> dict:
        """Holt den aktuellen Status eines Druckers"""
        status_data = self.printer_data.get(printer_id, {})
        
        if status_data:  # Wenn wir Daten haben
            # Konvertiere in das Format, das BambuLabInfo.jsx erwartet
            return {
                'temps': {
                    'hotend': status_data['temperatures']['nozzle'],
                    'bed': status_data['temperatures']['bed'],
                    'chamber': status_data['temperatures']['chamber']
                },
                'status': status_data['status'].lower(),  # Frontend erwartet Kleinbuchstaben
                'progress': status_data['progress']
            }
        
        # Fallback wenn keine Daten vorhanden
        return {
            'temps': {'hotend': 0, 'bed': 0, 'chamber': 0},
            'status': 'offline',
            'progress': 0
        }

    def disconnect_printer(self, printer_id: str):
        """Trennt die MQTT Verbindung eines Druckers"""
        if printer_id in self.clients:
            try:
                self.clients[printer_id].disconnect()
                del self.clients[printer_id]
                if printer_id in self.printer_data:
                    del self.printer_data[printer_id]
                if printer_id in self.stored_printers:
                    del self.stored_printers[printer_id]
            except Exception as e:
                logger.error(f"Error disconnecting printer {printer_id}: {e}")

    def _check_status_change(self, printer_id: str, print_data: dict):
        """Prüft auf wichtige Statusänderungen und sendet ggf. Benachrichtigungen"""
        gcode_state = print_data.get('gcode_state', '').lower()
        
        status_messages = {
            'finish': '✅ Druck erfolgreich beendet',
            'failed': '❌ Druck-Fehler aufgetreten',
            'stopped': '⚠️ Druck abgebrochen',
            'running': None  # Keine Nachricht für laufende Drucke
        }
        
        if gcode_state in status_messages and status_messages[gcode_state]:
            printer_name = self.stored_printers.get(printer_id, {}).get('name', f'Drucker {printer_id}')
            message = f"{status_messages[gcode_state]}\n*Drucker:* {printer_name}"
            
            # Sende Benachrichtigung
            send_printer_notification(printer_name, gcode_state, message)
            logger.info(f"Sending notification for state {gcode_state}: {message}")

# Globale Instanz
mqtt_service = MQTTService() 