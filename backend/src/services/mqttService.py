import paho.mqtt.client as mqtt
import json
import logging

logger = logging.getLogger(__name__)

class MQTTService:
    def __init__(self):
        self.clients = {}
        
    def connect_printer(self, printer_id: str, printer_type: str, ip: str):
        try:
            logger.info(f"Connecting MQTT for printer {printer_id} ({printer_type}) at {ip}")
            
            if printer_type == 'BAMBULAB':
                client = self.connect_bambulab(printer_id, ip)
            elif printer_type == 'CREALITY':
                client = self.connect_creality(printer_id, ip)
            
            self.clients[printer_id] = client
            logger.info(f"Successfully connected MQTT for printer {printer_id}")
            
        except Exception as e:
            logger.error(f"Failed to connect MQTT for printer {printer_id}: {e}", exc_info=True)
            raise
        
    def connect_creality(self, printer_id, ip):
        # Creality verwendet Port 1883
        client = mqtt.Client()
        client.connect(ip, 1883)
        
        # Creality-spezifische Topics
        client.subscribe([
            ("printer/status", 0),
            ("printer/progress", 0),
            ("printer/temperature", 0)
        ])
        
        def on_message(client, userdata, msg):
            # Creality JSON Format parsen
            try:
                data = json.loads(msg.payload)
                # Daten in einheitliches Format konvertieren
                # ...
                
            except Exception as e:
                logger.error(f"Error parsing Creality MQTT message: {e}")
                
        client.on_message = on_message
        client.loop_start()
        return client 