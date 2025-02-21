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
                'broker': printer_data['mqtt']['broker'],
                'port': printer_data['mqtt']['port']
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
                    logger.info(f"Successfully connected to MQTT broker")
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
                    logger.error(f"Failed to connect to MQTT broker, return code: {rc}")
            
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
                    logger.error(f"Unexpected MQTT disconnection, rc: {rc}")
                else:
                    logger.info("MQTT client disconnected")
            
            client.on_connect = on_connect
            client.on_message = on_message
            client.on_disconnect = on_disconnect
            
            # Verbinde zum konfigurierten MQTT Broker
            client.connect(mqtt_broker, mqtt_port, 60)
            client.loop_start()
            
            self.mqtt_clients[printer_id] = client
            logger.info(f"MQTT client started for printer {printer_id}")
            
        except Exception as e:
            logger.error(f"Error in MQTT connection: {e}", exc_info=True)
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
        return self.printers.get(printer_id, {}).get('status')
    
    def set_status_callback(self, printer_id: str, callback: Callable):
        """Setzt einen Callback für Status-Updates"""
        self.status_callbacks[printer_id] = callback

# Globale Instanz
octoprint_service = OctoPrintService() 