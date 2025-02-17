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
                    data = json.loads(msg.payload)
                    serial = msg.topic.split('/')[1]  # Format: device/SERIAL/report
                    
                    # Speichere die Seriennummer beim ersten Empfang
                    if printer_id not in self.stored_printers:
                        from src.services import getPrinters
                        for printer in getPrinters():
                            if printer['id'] == printer_id:
                                printer['serial'] = serial
                                # Speichere den aktualisierten Drucker
                                printer_file = os.path.join('/app/data/printers', f"{printer_id}.json")
                                with open(printer_file, 'w') as f:
                                    json.dump(printer, f, indent=2)
                                break
                    
                    if 'print' in data:
                        print_data = data['print']
                        status_data = {
                            'status': print_data.get('gcode_state', 'unknown'),
                            'temperatures': {
                                'nozzle': float(print_data.get('nozzle_temper', 0)),
                                'bed': float(print_data.get('bed_temper', 0)),
                                'chamber': float(print_data.get('chamber_temper', 0))
                            },
                            'targets': {
                                'nozzle': float(print_data.get('nozzle_target_temper', 0)),
                                'bed': float(print_data.get('bed_target_temper', 0))
                            },
                            'progress': float(print_data.get('mc_percent', 0)),
                            'remaining_time': int(print_data.get('mc_remaining_time', 0))
                        }
                        
                        # Cache die Daten
                        self.printer_data[printer_id] = status_data
                        logger.debug(f"Updated printer data: {self.printer_data}")
                        
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
                            self._check_status_change(printer_id, data)
                
                except Exception as e:
                    logger.error(f"Error processing MQTT message: {e}", exc_info=True)

            # Zusätzliche Debug-Callbacks
            def on_disconnect(client, userdata, rc):
                logger.warning(f"MQTT disconnected with code {rc}")

            def on_subscribe(client, userdata, mid, granted_qos):
                logger.info(f"Successfully subscribed with QoS: {granted_qos}")

            client.on_connect = on_connect
            client.on_message = on_message
            client.on_disconnect = on_disconnect
            client.on_subscribe = on_subscribe
            
            # Verbinde mit Bambulab MQTT Port und starte Loop
            client.connect(ip, MQTT_PORT, 60)
            client.loop_start()
            
            self.clients[printer_id] = client
            logger.info(f"Successfully connected MQTT for printer {printer_id}")
            
        except Exception as e:
            logger.error(f"Error connecting MQTT for printer {printer_id}: {e}", exc_info=True)
            raise

    def get_printer_status(self, printer_id: str) -> dict:
        """Holt den aktuellen Status eines Druckers"""
        try:
            status_data = self.printer_data.get(printer_id, {})
            logger.debug(f"Getting status for {printer_id}: {status_data}")
            
            if status_data:
                return {
                    'status': status_data['status'],
                    'temperatures': status_data['temperatures'],
                    'targets': status_data['targets'],
                    'progress': status_data['progress'],
                    'remaining_time': status_data['remaining_time']
                }
            
            # Fallback wenn keine Daten vorhanden
            return {
                'status': 'offline',
                'temperatures': {'hotend': 0, 'bed': 0, 'chamber': 0},
                'targets': {'hotend': 0, 'bed': 0},
                'progress': 0,
                'remaining_time': 0
            }
        except Exception as e:
            logger.error(f"Error getting printer status: {e}", exc_info=True)
            return {
                'status': 'offline',
                'temperatures': {'hotend': 0, 'bed': 0, 'chamber': 0},
                'targets': {'hotend': 0, 'bed': 0},
                'progress': 0,
                'remaining_time': 0
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

    def process_status_data(self, data):
        try:
            temperatures = {
                'bed': data['temperatures']['bed'],
                'hotend': data['temperatures']['hotend'],
                'chamber': data['temperatures']['chamber']
            }
            return {
                'temps': temperatures,
                'status': data.get('status', 'offline').lower(),
                'progress': data.get('progress', 0)
            }
        except Exception as e:
            logger.error(f"Error processing status data: {e}")
            return None

# Globale Instanz
mqtt_service = MQTTService() 