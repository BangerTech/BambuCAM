import paho.mqtt.client as mqtt
import json
import logging
from typing import Dict, Any, Optional, Callable
from datetime import datetime
import os
from pathlib import Path
import requests

logger = logging.getLogger(__name__)

# Definiere Basis-Verzeichnis für Drucker-Dateien
BASE_DIR = Path(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
DATA_DIR = BASE_DIR / 'data'
PRINTERS_DIR = DATA_DIR / 'printers'

class OctoPrintService:
    def __init__(self):
        self.printers: Dict[str, Dict[str, Any]] = {}
        self.mqtt_clients: Dict[str, mqtt.Client] = {}
        self.status_callbacks: Dict[str, Callable] = {}
        
    def add_printer(self, printer_data: Dict[str, Any]):
        printer_id = printer_data['id']
        
        # Speichere Drucker-Daten mit MQTT-Konfiguration
        self.printers[printer_id] = {
            'ip': printer_data['ip'],
            'name': printer_data['name'],
            'apiKey': printer_data.get('apiKey', ''),  # Store API key
            'mqtt': {  # MQTT-Konfiguration hinzufügen
                'broker': printer_data.get('mqttBroker', printer_data.get('mqtt', {}).get('broker', 'localhost')),
                'port': int(printer_data.get('mqttPort', printer_data.get('mqtt', {}).get('port', 1883)))
            },
            'status': {
                'temperatures': {
                    'hotend': 0,
                    'bed': 0,
                    'chamber': 0
                },
                'progress': 0,
                'status': 'connecting'
            }
        }
        
        # Verbinde MQTT
        self._connect_mqtt(printer_id)
        
    def _connect_mqtt(self, printer_id: str):
        """Verbindet mit dem MQTT Broker von OctoPrint"""
        try:
            printer = self.printers[printer_id]
            client = mqtt.Client(client_id=f"printcam_{printer_id}", protocol=mqtt.MQTTv31)
            
            # MQTT Broker Daten aus der Drucker-Konfiguration
            mqtt_config = printer.get('mqtt', {})
            mqtt_broker = mqtt_config.get('broker', 'localhost')
            mqtt_port = int(mqtt_config.get('port', 1883))  # Port als Integer
            
            # Callbacks setzen
            client.on_connect = lambda client, userdata, flags, rc: self._on_connect(client, userdata, flags, rc, printer_id)
            client.on_message = lambda client, userdata, msg: self._on_message(client, userdata, msg, printer_id)
            client.on_disconnect = lambda client, userdata, rc: self._on_disconnect(client, userdata, rc, printer_id)
            
            logger.info(f"Connecting to MQTT broker at {mqtt_broker}:{mqtt_port} for OctoPrint printer {printer_id}")
            
            # Verbindung herstellen
            client.connect(mqtt_broker, mqtt_port, 60)
            client.loop_start()
            
            # Client speichern
            self.mqtt_clients[printer_id] = client
            
        except Exception as e:
            logger.error(f"Error connecting to MQTT for OctoPrint printer {printer_id}: {e}", exc_info=True)
            # Status auf offline setzen
            if printer_id in self.printers and 'status' in self.printers[printer_id]:
                self.printers[printer_id]['status']['status'] = 'offline'
    
    def _on_connect(self, client, userdata, flags, rc, printer_id):
        """Callback wenn MQTT verbunden ist"""
        if rc == 0:
            logger.info(f"Connected to MQTT broker for OctoPrint printer {printer_id}")
            # Auf relevante Topics subscriben
            client.subscribe("octoPrint/temperature/#")
            client.subscribe("octoPrint/progress")
            client.subscribe("octoPrint/event/#")
            
            # Status auf verbunden setzen
            if printer_id in self.printers and 'status' in self.printers[printer_id]:
                self.printers[printer_id]['status']['status'] = 'ready'
        else:
            logger.error(f"Failed to connect to MQTT broker for OctoPrint printer {printer_id}, rc={rc}")
            # Status auf offline setzen
            if printer_id in self.printers and 'status' in self.printers[printer_id]:
                self.printers[printer_id]['status']['status'] = 'offline'
    
    def _on_disconnect(self, client, userdata, rc, printer_id):
        """Callback wenn MQTT getrennt wird"""
        logger.warning(f"Disconnected from MQTT broker for OctoPrint printer {printer_id}, rc={rc}")
        # Status auf offline setzen
        if printer_id in self.printers and 'status' in self.printers[printer_id]:
            self.printers[printer_id]['status']['status'] = 'offline'
    
    def _on_message(self, client, userdata, msg, printer_id):
        """Callback für MQTT Nachrichten"""
        try:
            logger.debug(f"Received MQTT message on topic {msg.topic}")
            
            # Temperatur-Updates verarbeiten
            if msg.topic.startswith("octoPrint/temperature/"):
                sensor = msg.topic.split("/")[-1]
                payload_str = msg.payload.decode('utf-8')
                
                try:
                    # Versuche, die Nachricht als JSON zu parsen
                    payload_json = json.loads(payload_str)
                    
                    # Extrahiere den tatsächlichen Temperaturwert
                    if "actual" in payload_json:
                        temperature = float(payload_json["actual"])
                    elif "temperature" in payload_json:
                        temperature = float(payload_json["temperature"])
                    else:
                        logger.warning(f"Unbekanntes Temperaturformat: {payload_str}")
                        return
                        
                except json.JSONDecodeError:
                    # Fallback: Versuche, die Nachricht direkt als Float zu konvertieren
                    try:
                        temperature = float(payload_str)
                    except ValueError:
                        logger.warning(f"Konnte Temperatur nicht parsen: {payload_str}")
                        return
                
                if printer_id in self.printers and 'status' in self.printers[printer_id]:
                    if sensor == "tool0":
                        self.printers[printer_id]['status']['temperatures']['hotend'] = temperature
                    elif sensor == "bed":
                        self.printers[printer_id]['status']['temperatures']['bed'] = temperature
                    elif sensor == "chamber":
                        self.printers[printer_id]['status']['temperatures']['chamber'] = temperature
                    
                    # Status aktualisieren
                    self.printers[printer_id]['status']['status'] = 'ready'
                    
                    # Debug-Ausgabe des aktualisierten Status
                    logger.debug(f"Updated printer status: {self.printers[printer_id]['status']}")
                    
                    # Callback aufrufen, wenn vorhanden
                    if printer_id in self.status_callbacks:
                        self.status_callbacks[printer_id](self.printers[printer_id]['status'])
            
            # Fortschritt verarbeiten
            elif msg.topic == "octoPrint/progress":
                payload_str = msg.payload.decode('utf-8')
                
                try:
                    # Versuche, die Nachricht als JSON zu parsen
                    payload_json = json.loads(payload_str)
                    
                    # Extrahiere den Fortschrittswert
                    if "completion" in payload_json:
                        progress = float(payload_json["completion"])
                    else:
                        # Fallback: Versuche, die Nachricht direkt als Float zu konvertieren
                        progress = float(payload_str)
                        
                except (json.JSONDecodeError, ValueError):
                    try:
                        # Fallback: Versuche, die Nachricht direkt als Float zu konvertieren
                        progress = float(payload_str)
                    except ValueError:
                        logger.warning(f"Konnte Fortschritt nicht parsen: {payload_str}")
                        return
                
                if printer_id in self.printers and 'status' in self.printers[printer_id]:
                    self.printers[printer_id]['status']['progress'] = progress
                    
                    # Status auf Drucken setzen, wenn Fortschritt > 0
                    if progress > 0:
                        self.printers[printer_id]['status']['status'] = 'printing'
                    
                    # Callback aufrufen, wenn vorhanden
                    if printer_id in self.status_callbacks:
                        self.status_callbacks[printer_id](self.printers[printer_id]['status'])
            
            # Event-Updates verarbeiten
            elif msg.topic.startswith("octoPrint/event/"):
                event_type = msg.topic.split("/")[-1]
                
                if printer_id in self.printers and 'status' in self.printers[printer_id]:
                    if event_type == "PrintStarted":
                        self.printers[printer_id]['status']['status'] = 'printing'
                    elif event_type == "PrintDone":
                        self.printers[printer_id]['status']['status'] = 'completed'
                    elif event_type == "PrintFailed":
                        self.printers[printer_id]['status']['status'] = 'failed'
                    elif event_type == "PrintPaused":
                        self.printers[printer_id]['status']['status'] = 'paused'
                    elif event_type == "PrintResumed":
                        self.printers[printer_id]['status']['status'] = 'printing'
                    
                    # Callback aufrufen, wenn vorhanden
                    if printer_id in self.status_callbacks:
                        self.status_callbacks[printer_id](self.printers[printer_id]['status'])
            
        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}", exc_info=True)
    
    def remove_printer(self, printer_id: str):
        """Entfernt einen OctoPrint Drucker"""
        if printer_id in self.mqtt_clients:
            try:
                client = self.mqtt_clients[printer_id]
                client.loop_stop()
                client.disconnect()
                del self.mqtt_clients[printer_id]
            except Exception as e:
                logger.error(f"Error disconnecting MQTT client for printer {printer_id}: {e}")
        
        if printer_id in self.status_callbacks:
            del self.status_callbacks[printer_id]
        
        if printer_id in self.printers:
            del self.printers[printer_id]
    
    def get_printer_status(self, printer_id: str) -> Optional[Dict[str, Any]]:
        """Holt den aktuellen Status eines OctoPrint Druckers"""
        printer_data = self.printers.get(printer_id, {})
        status = printer_data.get('status')
        if status:
            # Format the status to match the expected frontend format
            hotend_temp = status['temperatures']['hotend']
            return {
                'id': printer_id,
                'name': printer_data.get('name', ''),
                'temps': {
                    'hotend': hotend_temp,
                    'nozzle': hotend_temp,  # Add nozzle property for frontend compatibility
                    'bed': status['temperatures']['bed'],
                    'chamber': status['temperatures']['chamber']
                },
                'temperatures': {  # Add temperatures property for frontend compatibility
                    'hotend': hotend_temp,
                    'nozzle': hotend_temp,
                    'bed': status['temperatures']['bed'],
                    'chamber': status['temperatures']['chamber']
                },
                'status': status['status'],
                'progress': status['progress']
            }
        return None
    
    def set_status_callback(self, printer_id: str, callback: Callable):
        """Setzt einen Callback für Status-Updates"""
        self.status_callbacks[printer_id] = callback
        
    def disconnect_all(self):
        """Trennt alle MQTT Verbindungen"""
        for printer_id, client in list(self.mqtt_clients.items()):
            try:
                logger.info(f"Disconnecting MQTT client for OctoPrint printer {printer_id}")
                client.loop_stop()
                client.disconnect()
            except Exception as e:
                logger.error(f"Error disconnecting MQTT client for printer {printer_id}: {e}")
        self.mqtt_clients.clear()
        
    def reconnect_all(self):
        """Verbindet alle MQTT Verbindungen neu"""
        logger.info(f"Reconnecting all OctoPrint MQTT clients")
        # Erst alle Verbindungen trennen
        self.disconnect_all()
        
        # Dann alle neu verbinden
        for printer_id in self.printers:
            try:
                self._connect_mqtt(printer_id)
            except Exception as e:
                logger.error(f"Error reconnecting MQTT for printer {printer_id}: {e}")
                
    def initialize_from_stored_printers(self):
        """Lädt alle gespeicherten OctoPrint-Drucker und stellt MQTT-Verbindungen her"""
        logger.info("Initializing OctoPrint service from stored printers")
        try:
            # Stelle sicher, dass das Verzeichnis existiert
            if not os.path.exists(PRINTERS_DIR):
                logger.warning(f"Printers directory {PRINTERS_DIR} does not exist")
                return
                
            # Zähle gefundene OctoPrint-Drucker
            octoprint_count = 0
            
            # Durchlaufe alle Drucker-Dateien
            for printer_file in os.listdir(PRINTERS_DIR):
                if printer_file.endswith('.json'):
                    try:
                        with open(os.path.join(PRINTERS_DIR, printer_file), 'r') as f:
                            printer_data = json.load(f)
                            
                            # Prüfe, ob es ein OctoPrint-Drucker ist
                            if printer_data.get('type') == 'OCTOPRINT':
                                printer_id = printer_data.get('id')
                                if not printer_id:
                                    # Verwende Dateinamen ohne .json als ID
                                    printer_id = printer_file.replace('.json', '')
                                    printer_data['id'] = printer_id
                                
                                logger.info(f"Found OctoPrint printer: {printer_data.get('name')} (ID: {printer_id})")
                                
                                # Füge Drucker hinzu und verbinde MQTT
                                self.add_printer(printer_data)
                                octoprint_count += 1
                    except Exception as e:
                        logger.error(f"Error loading printer from {printer_file}: {e}", exc_info=True)
            
            logger.info(f"Initialized {octoprint_count} OctoPrint printers")
            
        except Exception as e:
            logger.error(f"Error initializing OctoPrint service: {e}", exc_info=True)

    def emergency_stop_printer(self, printer_id: str):
        """Sendet einen Notfall-Stopp-Befehl an einen OctoPrint Drucker"""
        try:
            if printer_id not in self.printers:
                logger.error(f"Printer {printer_id} not found")
                return False
                
            printer = self.printers[printer_id]
            printer_ip = printer.get('ip')
            
            if not printer_ip:
                logger.error(f"No IP address found for printer {printer_id}")
                return False
            
            success = False
            
            # Try MQTT first
            if printer_id in self.mqtt_clients:
                client = self.mqtt_clients[printer_id]
                if client.is_connected():
                    # Sende Notfall-Stopp über MQTT
                    # OctoPrint verwendet normalerweise ein anderes Topic-Format
                    command_topic = "octoPrint/command/emergency_stop"
                    
                    logger.info(f"Sending emergency stop command to OctoPrint printer {printer_id} via MQTT")
                    result = client.publish(command_topic, "M112")  # M112 ist der Emergency Stop G-Code
                    
                    if result.rc == mqtt.MQTT_ERR_SUCCESS:
                        logger.info(f"Emergency stop command sent successfully to OctoPrint printer {printer_id} via MQTT")
                        success = True
                    else:
                        logger.warning(f"Failed to send emergency stop command via MQTT: {result.rc}")
                else:
                    logger.warning(f"MQTT client for printer {printer_id} is not connected")
            else:
                logger.warning(f"No MQTT client found for printer {printer_id}")
            
            # If MQTT failed, try REST API
            if not success:
                try:
                    # Get API key from printer data
                    api_key = printer.get('apiKey')
                    
                    if not api_key:
                        logger.warning(f"No API key found for OctoPrint printer {printer_id}, trying without authentication")
                    
                    # Build the REST API URL
                    api_url = f"http://{printer_ip}/api/printer/command"
                    
                    # Prepare headers with API key if available
                    headers = {
                        'Content-Type': 'application/json'
                    }
                    
                    if api_key:
                        headers['X-Api-Key'] = api_key
                    
                    # Prepare payload with M112 command
                    payload = {
                        "commands": ["M112"]
                    }
                    
                    logger.info(f"Sending emergency stop command to OctoPrint printer {printer_id} via REST API")
                    
                    response = requests.post(api_url, json=payload, headers=headers, timeout=5)
                    
                    if response.status_code == 204 or response.status_code == 200:
                        logger.info(f"Emergency stop command sent successfully to OctoPrint printer {printer_id} via REST API")
                        success = True
                    else:
                        logger.error(f"Failed to send emergency stop command via REST API: {response.status_code} - {response.text}")
                except Exception as e:
                    logger.error(f"Error sending emergency stop command via REST API: {e}", exc_info=True)
            
            # Update printer status if successful
            if success:
                # Aktualisiere den Status des Druckers
                if 'status' in self.printers[printer_id]:
                    self.printers[printer_id]['status']['status'] = 'stopped'
                    
                    # Callback aufrufen, wenn vorhanden
                    if printer_id in self.status_callbacks:
                        self.status_callbacks[printer_id](self.printers[printer_id]['status'])
                
                return True
            else:
                logger.error(f"Failed to send emergency stop command to OctoPrint printer {printer_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending emergency stop command to OctoPrint printer: {e}", exc_info=True)
            return False

# Globale Instanz
octoprint_service = OctoPrintService() 