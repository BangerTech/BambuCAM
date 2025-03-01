import paho.mqtt.client as mqtt
import json
import logging
from typing import Dict, Any, Optional, Callable
from datetime import datetime

logger = logging.getLogger(__name__)

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
            
            logger.info(f"Connecting to MQTT broker at {mqtt_broker}:{mqtt_port}")
            
            def on_connect(client, userdata, flags, rc):
                if rc == 0:
                    logger.info(f"Successfully connected to MQTT broker for OctoPrint printer {printer_id}")
                    # OctoPrint MQTT Topics
                    topics = [
                        ("octoPrint/temperature/tool0", 0),  # QoS 0
                        ("octoPrint/temperature/bed", 0),
                        ("octoPrint/event/PrintStarted", 0),
                        ("octoPrint/event/PrintDone", 0),
                        ("octoPrint/event/PrintFailed", 0),
                        ("octoPrint/progress/printing", 0)
                    ]
                    
                    for topic, qos in topics:
                        logger.info(f"Subscribing to {topic}")
                        client.subscribe(topic, qos)
                else:
                    logger.error(f"Failed to connect to MQTT broker for OctoPrint printer {printer_id}, return code: {rc}")
            
            def on_message(client, userdata, msg):
                try:
                    logger.debug(f"Received MQTT message on topic {msg.topic}")
                    
                    topic = msg.topic
                    payload = msg.payload.decode()
                    data = json.loads(payload)
                    
                    if "progress/printing" in topic:
                        # Status aus den printer_data flags auslesen
                        if 'printer_data' in data and 'state' in data['printer_data']:
                            state = data['printer_data']['state']
                            flags = state.get('flags', {})
                            
                            if flags.get('error'):
                                self.printers[printer_id]['status']['status'] = 'error'
                            elif flags.get('printing'):
                                self.printers[printer_id]['status']['status'] = 'printing'
                            elif flags.get('paused'):
                                self.printers[printer_id]['status']['status'] = 'paused'
                            elif flags.get('operational'):
                                self.printers[printer_id]['status']['status'] = 'ready'
                            else:
                                self.printers[printer_id]['status']['status'] = 'offline'
                            
                            # Progress aktualisieren
                            if 'progress' in data['printer_data']:
                                completion = data['printer_data']['progress'].get('completion', 0)
                                if completion is not None:
                                    self.printers[printer_id]['status']['progress'] = float(completion)
                    
                    if "temperature" in topic:
                        if "tool0" in topic:
                            self.printers[printer_id]['status']['temperatures']['hotend'] = float(data.get('actual', 0))
                        elif "bed" in topic:
                            self.printers[printer_id]['status']['temperatures']['bed'] = float(data.get('actual', 0))
                    elif "event" in topic:
                        event_type = topic.split('/')[-1]
                        if event_type == "PrintStarted":
                            self.printers[printer_id]['status']['status'] = 'printing'
                        elif event_type == "PrintDone":
                            self.printers[printer_id]['status']['status'] = 'completed'
                        elif event_type == "PrintFailed":
                            self.printers[printer_id]['status']['status'] = 'failed'
                    
                    logger.debug(f"Updated printer status: {self.printers[printer_id]['status']}")
                    
                except Exception as e:
                    logger.error(f"Error processing MQTT message: {e}", exc_info=True)
            
            def on_disconnect(client, userdata, rc):
                if rc != 0:
                    logger.error(f"Unexpected MQTT disconnection for OctoPrint printer {printer_id}, rc: {rc}")
                else:
                    logger.info(f"MQTT client disconnected for OctoPrint printer {printer_id}")
            
            client.on_connect = on_connect
            client.on_message = on_message
            client.on_disconnect = on_disconnect
            
            # Verbinde zum konfigurierten MQTT Broker
            client.connect(mqtt_broker, mqtt_port, 60)
            client.loop_start()
            
            self.mqtt_clients[printer_id] = client
            logger.info(f"MQTT client started for OctoPrint printer {printer_id}")
            
        except Exception as e:
            logger.error(f"Error in MQTT connection for OctoPrint printer {printer_id}: {e}", exc_info=True)
            self.printers[printer_id]['status']['status'] = 'offline'
    
    def remove_printer(self, printer_id: str):
        """Entfernt einen Drucker und trennt MQTT"""
        if printer_id in self.mqtt_clients:
            self.mqtt_clients[printer_id].loop_stop()
            self.mqtt_clients[printer_id].disconnect()
            del self.mqtt_clients[printer_id]
        
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

# Globale Instanz
octoprint_service = OctoPrintService() 