import requests
import logging
from datetime import datetime
from enum import Enum
from pathlib import Path
import json
import os
from src.config import Config
import paho.mqtt.client as mqtt
import threading
import time
import ssl
from src.services.printerService import getPrinters

logger = logging.getLogger(__name__)

class Region(Enum):
    China = "china"
    Europe = "europe" 
    NorthAmerica = "north_america"
    AsiaPacific = "asia_pacific"
    Other = "other"

class MQTTSClient(mqtt.Client):
    """
    MQTT Client that supports custom certificate Server Name Indication (SNI) for TLS.
    """
    def __init__(self, *args, server_name=None, **kwargs):
        super().__init__(*args, **kwargs)
        self._server_name = server_name

    def _ssl_wrap_socket(self, tcp_sock) -> ssl.SSLSocket:
        orig_host = self._host
        if self._server_name:
            self._host = self._server_name
        res = super()._ssl_wrap_socket(tcp_sock)
        self._host = orig_host
        return res

class BambuCloudService:
    def __init__(self):
        self.base_url = "https://api.bambulab.com"
        self.mqtt_host = "us.mqtt.bambulab.com"
        self.session = requests.Session()
        self.config_file = Config.BAMBU_CLOUD_FILE
        self.mqtt_client = None
        self.mqtt_connected = False
        self.token = None
        self.config = {}
        self.temperature_data = {}
        self.printers = []  # Initialize printers list
        self.printer_data = {}  # Initialize printer data dictionary
        self.load_config()

    def disconnect_mqtt(self):
        """Disconnect and cleanup MQTT connection"""
        try:
            if self.mqtt_client:
                logger.info("Disconnecting MQTT client")
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()
                self.mqtt_client = None
            self.mqtt_connected = False
            self.printer_data = {}  # Clear stored printer data
            logger.info("MQTT client disconnected and data cleared")
        except Exception as e:
            logger.error(f"Error disconnecting MQTT: {e}", exc_info=True)

    def load_config(self):
        """Load saved cloud credentials and automatically set up service if valid"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    self.config = json.load(f)
                    logger.info("Loading cloud credentials from config")
                    
                    if self.config.get('token'):
                        self.token = self.config['token']
                        # Update session headers with token
                        self.session.headers.update({
                            "Authorization": f"Bearer {self.token}"
                        })
                        
                        # Test if token is still valid
                        try:
                            response = self.session.get(f"{self.base_url}/v1/design-user-service/my/preference")
                            if response.status_code == 200:
                                logger.info("Token is valid")
                                return {
                                    "success": True,
                                    "token": self.token,
                                    "email": self.config.get('email'),
                                    "user_id": self.config.get('user_id')
                                }
                            else:
                                logger.warning("Token is expired or invalid")
                                # Disconnect MQTT and clear data
                                self.disconnect_mqtt()
                                # Clear token and config
                                self.token = None
                                self.config = {}
                                # Delete config file
                                os.remove(self.config_file)
                                return {
                                    "success": False,
                                    "error": "Token expired"
                                }
                        except Exception as e:
                            logger.error(f"Error testing token: {e}", exc_info=True)
                            # Disconnect MQTT and clear data
                            self.disconnect_mqtt()
                            return {
                                "success": False,
                                "error": str(e)
                            }
                    else:
                        logger.warning("No token found in config")
                        return {
                            "success": False,
                            "error": "No token found"
                        }
            else:
                logger.info("No config file found")
                return {
                    "success": False,
                    "error": "No config file"
                }
        except Exception as e:
            logger.error(f"Error loading cloud config: {e}", exc_info=True)
            self.config = {}
            self.token = None
            # Disconnect MQTT and clear data
            self.disconnect_mqtt()
            return {
                "success": False,
                "error": str(e)
            }

    def get_cloud_printers_internal(self):
        """Internal method to get list of cloud printers"""
        try:
            if not self.token:
                logger.warning("No token available for cloud printers request")
                return []

            response = self.session.get(f"{self.base_url}/v1/iot-service/api/user/bind")
            
            if response.status_code == 200:
                data = response.json()
                logger.debug(f"Get cloud printers response: {data}")
                
                if data.get('devices'):
                    return data['devices']
            
            logger.error(f"Failed to get cloud printers: {response.status_code} - {response.text}")
            return []
            
        except Exception as e:
            logger.error(f"Error getting cloud printers: {e}", exc_info=True)
            return []

    def get_cloud_printers(self):
        """Get list of cloud printers for API"""
        # Always refresh printers list when this method is called
        self.printers = self.get_cloud_printers_internal()
        
        # Don't set up MQTT here, wait until a printer is actually added to the app
        
        # Format printers for API response
        return [{
            'id': printer['dev_id'],
            'name': printer['name'],
            'model': printer['dev_product_name'],
            'status': printer.get('status', 'offline'),
            'online': printer.get('status') == 'ACTIVE' or printer.get('print_status') == 'ACTIVE',
            'type': 'cloud',
            'access_code': printer['dev_access_code'],
            'print_status': printer.get('print_status', 'IDLE'),
            'dev_id': printer['dev_id']
        } for printer in self.printers] if self.printers else []

    def login(self, email: str, password: str, verification_code: str = None):
        """Login with Bambu Cloud account"""
        try:
            url = f"{self.base_url}/v1/user-service/user/login"
            
            if verification_code:
                data = {
                    "account": email,
                    "code": verification_code
                }
            else:
                # Request verification code first
                code_url = f"{self.base_url}/v1/user-service/user/sendemail/code"
                self.session.post(code_url, json={
                    "email": email,
                    "type": "codeLogin"
                })
                
                data = {
                    "account": email,
                    "password": password
                }
            
            response = self.session.post(url, json=data)
            
            if response.status_code == 200:
                data = response.json()
                
                if not data.get("accessToken"):
                    return {
                        "success": False,
                        "error": "2FA required. Please check your email for the code.",
                        "needs_verification": True
                    }
                    
                self.token = data.get("accessToken")
                if self.token:
                    # Update session headers with new token
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.token}"
                    })
                    logger.info("Successfully logged in and updated session headers")
                    
                    # Get user ID and setup MQTT
                    user_id = self.get_user_id()
                    if user_id:
                        # Update config with new credentials
                        self.config.update({
                            'email': email,
                            'token': self.token,
                            'user_id': user_id,
                            'connected': True
                        })
                        if verification_code:
                            self.config['password'] = password

                        # Save config to file
                        try:
                            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
                            with open(self.config_file, 'w') as f:
                                json.dump(self.config, f, indent=2)
                            logger.info("Saved cloud configuration to file")
                        except Exception as e:
                            logger.error(f"Failed to save cloud config: {e}", exc_info=True)

                        logger.info(f"Retrieved user ID: {user_id}")
                        # Don't setup MQTT here, wait until printers are requested
                    else:
                        logger.warning("Could not retrieve user ID after login")
                    
                    return {"success": True, "token": self.token}
            
            error_msg = f"Login failed: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }
            
        except Exception as e:
            logger.error(f"Login error: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def get_user_id(self):
        """Get user ID from preferences API"""
        try:
            if not self.token:
                return None
            
            response = self.session.get(f"{self.base_url}/v1/design-user-service/my/preference")
            
            if response.status_code == 200:
                data = response.json()
                return str(data.get('uid'))
                
            return None
        except Exception as e:
            logger.error(f"Failed to get user ID: {e}", exc_info=True)
            return None
            
    def setup_mqtt(self):
        """Setup MQTT connection"""
        if not self.token or not self.config.get('user_id'):
            logger.warning("Token or user ID missing for MQTT setup")
            return False

        try:
            # Stop existing client if any
            if self.mqtt_client:
                try:
                    self.mqtt_client.loop_stop()
                    self.mqtt_client.disconnect()
                except:
                    pass

            # Create MQTT client with clean session True
            client_id = f"bbl_client_{self.config.get('user_id')}_{int(time.time())}"
            logger.info(f"Creating MQTT client with ID: {client_id}")
            
            self.mqtt_client = mqtt.Client(
                client_id=client_id,
                clean_session=True,
                protocol=mqtt.MQTTv311,
                transport="tcp"
            )
            
            # Set callbacks
            self.mqtt_client.on_connect = self.on_mqtt_connect
            self.mqtt_client.on_disconnect = self.on_mqtt_disconnect
            self.mqtt_client.on_message = self.on_mqtt_message
            self.mqtt_client.on_subscribe = self.on_mqtt_subscribe
            self.mqtt_client.on_log = self.on_mqtt_log

            # Configure TLS
            logger.debug("Configuring TLS for MQTT connection")
            self.mqtt_client.tls_set(
                certfile=None,
                keyfile=None,
                cert_reqs=ssl.CERT_NONE
            )
            self.mqtt_client.tls_insecure_set(True)

            # Set credentials
            username = f"bbl_client_{self.config.get('user_id')}"
            password = self.token
            logger.debug(f"Setting MQTT credentials - Username: {username}")
            self.mqtt_client.username_pw_set(username, password)
            
            # Start MQTT loop
            self.mqtt_client.loop_start()
            
            # Connect to MQTT broker
            try:
                self.mqtt_client.connect(self.mqtt_host, 8883, keepalive=60)
                logger.info("MQTT connection initiated")
                return True
            except Exception as e:
                logger.error(f"Failed to connect to MQTT broker: {e}", exc_info=True)
                return False
                
        except Exception as e:
            logger.error(f"Error setting up MQTT: {e}", exc_info=True)
            return False

    def get_cloud_printer_status(self, printer_id: str, access_code: str):
        """Get status of a cloud printer"""
        try:
            if not self.token:
                logger.warning("No token available for cloud printer status request")
                return None
            
            # Check if we have MQTT data for this printer
            mqtt_data = self.get_printer_data(printer_id)
            if mqtt_data:
                logger.info(f"Using MQTT data for printer {printer_id}")
                return mqtt_data

            # Die korrekte URL für den Drucker-Status
            url = f"{self.base_url}/v1/iot-service/api/devices/{printer_id}"
            headers = {
                **self.session.headers,
                "dev-access-code": access_code
            }
            
            logger.debug(f"Requesting printer status from URL: {url}")
            logger.debug(f"Headers: {headers}")
            
            response = self.session.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Got cloud printer status for {printer_id}")
                
                # Format the response to match our MQTT data structure
                formatted_data = {
                    'device': {
                        'status': data.get('status', 'OFFLINE'),
                        'hotend_temp': float(data.get('nozzle_temper', 0)),
                        'bed_temp': float(data.get('bed_temper', 0)),
                        'chamber_temp': float(data.get('chamber_temper', 0)),
                        'target_nozzle_temp': float(data.get('nozzle_target_temper', 0)),
                        'target_bed_temp': float(data.get('bed_target_temper', 0))
                    },
                    'print': {
                        'gcode_state': data.get('gcode_state', 'IDLE'),
                        'mc_percent': float(data.get('mc_percent', 0)),
                        'mc_remaining_time': int(data.get('mc_remaining_time', 0)),
                        'current_layer': int(data.get('layer_num', 0)),
                        'total_layers': int(data.get('total_layer_num', 0))
                    }
                }
                return formatted_data
            
            # Try alternative URL format if the first one fails
            alt_url = f"{self.base_url}/v1/iot-service/api/user/bind/device/{printer_id}/status"
            logger.debug(f"First URL failed, trying alternative URL: {alt_url}")
            
            response = self.session.get(alt_url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Got cloud printer status from alternative URL for {printer_id}")
                
                # Format the response to match our MQTT data structure
                formatted_data = {
                    'device': {
                        'status': data.get('status', 'OFFLINE'),
                        'hotend_temp': float(data.get('nozzle_temper', 0)),
                        'bed_temp': float(data.get('bed_temper', 0)),
                        'chamber_temp': float(data.get('chamber_temper', 0)),
                        'target_nozzle_temp': float(data.get('nozzle_target_temper', 0)),
                        'target_bed_temp': float(data.get('bed_target_temper', 0))
                    },
                    'print': {
                        'gcode_state': data.get('gcode_state', 'IDLE'),
                        'mc_percent': float(data.get('mc_percent', 0)),
                        'mc_remaining_time': int(data.get('mc_remaining_time', 0)),
                        'current_layer': int(data.get('layer_num', 0)),
                        'total_layers': int(data.get('total_layer_num', 0))
                    }
                }
                return formatted_data
            
            logger.error(f"Failed to get cloud printer status: {response.status_code} - {response.text}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting cloud printer status: {e}", exc_info=True)
            return None

    def get_stream_url(self, printer_id: str, access_code: str):
        """Get video stream URL for a cloud printer"""
        try:
            if not self.token:
                logger.warning("No token available for stream URL request")
                return None

            # Updated API endpoint for live stream
            url = f"{self.base_url}/v1/iot-service/api/devices/{printer_id}/live"
            headers = {
                **self.session.headers,
                "dev-access-code": access_code
            }
            
            logger.debug(f"Requesting stream URL from: {url}")
            logger.debug(f"Headers: {headers}")
            
            response = self.session.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Got stream URL for printer {printer_id}")
                return {
                    'url': data.get('url'),
                    'token': data.get('token')
                }
            
            logger.error(f"Failed to get stream URL: {response.status_code} - {response.text}")
            return {
                'url': None,
                'token': None,
                'type': 'unavailable',
                'error': f"Stream unavailable: {response.status_code}"
            }
            
        except Exception as e:
            logger.error(f"Error getting stream URL: {e}", exc_info=True)
            return {
                'url': None,
                'token': None,
                'type': 'unavailable',
                'error': str(e)
            }

    def get_printer_data(self, device_id):
        """Get current printer data"""
        if hasattr(self, 'printer_data') and device_id in self.printer_data:
            # Format the data to match the expected structure
            data = self.printer_data[device_id]
            return {
                'device': {
                    'status': data.get('device', {}).get('status', 'OFFLINE'),
                    'hotend_temp': data.get('device', {}).get('hotend_temp', 0.0),
                    'bed_temp': data.get('device', {}).get('bed_temp', 0.0),
                    'chamber_temp': data.get('device', {}).get('chamber_temp', 0.0),
                    'target_nozzle_temp': data.get('device', {}).get('target_nozzle_temp', 0.0),
                    'target_bed_temp': data.get('device', {}).get('target_bed_temp', 0.0)
                },
                'print': {
                    'gcode_state': data.get('print', {}).get('gcode_state', 'IDLE'),
                    'mc_percent': data.get('print', {}).get('mc_percent', 0.0),
                    'mc_remaining_time': data.get('print', {}).get('mc_remaining_time', 0),
                    'current_layer': data.get('print', {}).get('current_layer', 0),
                    'total_layers': data.get('print', {}).get('total_layers', 0)
                }
            }
        return None

    def request_full_printer_status(self, printer_id):
        """Request full printer status using pushing.pushall command"""
        if not self.mqtt_client or not self.mqtt_connected:
            logger.warning("MQTT client not connected, cannot request printer status")
            return

        try:
            request_topic = f"device/{printer_id}/request"
            message = {
                "pushing": {
                    "sequence_id": str(int(time.time())),
                    "command": "pushall",
                    "version": 1,
                    "push_target": 1
                }
            }
            logger.info(f"Requesting full printer status for {printer_id}")
            self.mqtt_client.publish(request_topic, json.dumps(message))
        except Exception as e:
            logger.error(f"Error requesting printer status: {e}", exc_info=True)

    def setup_mqtt_for_printer(self, printer_id):
        """Setup MQTT connection for a specific printer"""
        logger.info(f"Setting up MQTT for printer {printer_id}")
        
        # Check if we have the necessary credentials
        if not self.token or not self.config.get('user_id'):
            logger.warning("Token or user ID missing for MQTT setup")
            return False
            
        # Check if the printer exists in our list
        printer_exists = False
        for printer in self.printers:
            if printer['dev_id'] == printer_id:
                printer_exists = True
                break
                
        if not printer_exists:
            # Refresh printer list to make sure we have the latest data
            self.printers = self.get_cloud_printers_internal()
            
            # Check again after refresh
            for printer in self.printers:
                if printer['dev_id'] == printer_id:
                    printer_exists = True
                    break
        
        if not printer_exists:
            logger.warning(f"Printer {printer_id} not found in cloud printers list")
            # Force add the printer to our list to ensure we can subscribe to it
            self.printers.append({'dev_id': printer_id})
            logger.info(f"Forcibly added printer {printer_id} to list for MQTT subscription")
            printer_exists = True
            
        # Setup MQTT connection
        if not self.mqtt_connected or not self.mqtt_client:
            try:
                # Stop existing client if any
                if self.mqtt_client:
                    try:
                        self.mqtt_client.loop_stop()
                        self.mqtt_client.disconnect()
                    except:
                        pass

                # Create MQTT client with clean session True
                client_id = f"bbl_client_{self.config.get('user_id')}_{int(time.time())}"
                logger.info(f"Creating MQTT client with ID: {client_id}")
                
                self.mqtt_client = mqtt.Client(
                    client_id=client_id,
                    clean_session=True,
                    protocol=mqtt.MQTTv311,
                    transport="tcp"
                )
                
                # Configure TLS with specific version
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                context.minimum_version = ssl.TLSVersion.TLSv1_2
                context.maximum_version = ssl.TLSVersion.TLSv1_2
                self.mqtt_client.tls_set_context(context)
                
                # Enable more debug output
                self.mqtt_client.enable_logger(logger)
                
                # Set credentials (username must be u_{uid})
                mqtt_username = f"u_{self.config['user_id']}"
                logger.info(f"Setting MQTT credentials - Username: {mqtt_username}")
                self.mqtt_client.username_pw_set(mqtt_username, self.token)
                
                # Set callbacks
                self.mqtt_client.on_connect = self.on_mqtt_connect
                self.mqtt_client.on_message = self.on_mqtt_message
                self.mqtt_client.on_disconnect = self.on_mqtt_disconnect
                self.mqtt_client.on_subscribe = self.on_mqtt_subscribe
                self.mqtt_client.on_log = self.on_mqtt_log
                
                # Store the printer ID to subscribe to on connect
                self.mqtt_client.user_data_set({'printer_id': printer_id})
                
                # Connect to broker
                logger.info(f"Connecting to MQTT broker at {self.mqtt_host} with username {mqtt_username}")
                self.mqtt_client.connect(self.mqtt_host, 8883, keepalive=60)
                
                # Start loop in background
                self.mqtt_client.loop_start()
                
                # Wait a bit for the connection to establish
                time.sleep(2)
                
                # Request full printer status after connection
                if self.mqtt_connected:
                    self.request_full_printer_status(printer_id)
                
                return self.mqtt_connected
                
            except Exception as e:
                logger.error(f"Failed to setup MQTT: {e}", exc_info=True)
                if self.mqtt_client:
                    try:
                        self.mqtt_client.loop_stop()
                        self.mqtt_client.disconnect()
                    except:
                        pass
                    self.mqtt_client = None
                self.mqtt_connected = False
                return False
        else:
            # If already connected, make sure we're subscribed to this printer's topic
            if self.mqtt_client:
                report_topic = f"device/{printer_id}/report"
                request_topic = f"device/{printer_id}/request"
                logger.info(f"Already connected to MQTT, subscribing to topics: {report_topic}, {request_topic}")
                self.mqtt_client.subscribe([(report_topic, 0), (request_topic, 0)])
                # Request full printer status
                self.request_full_printer_status(printer_id)
                
        return False

    def on_mqtt_connect(self, client, userdata, flags, rc):
        """Callback when client connects to MQTT broker"""
        rc_codes = {
            0: "Connection successful",
            1: "Connection refused - incorrect protocol version",
            2: "Connection refused - invalid client identifier",
            3: "Connection refused - server unavailable",
            4: "Connection refused - bad username or password",
            5: "Connection refused - not authorized"
        }
        if rc == 0:
            logger.info("MQTT Connected successfully")
            self.mqtt_connected = True
            # Subscribe to printer topics if provided in userdata
            if userdata and 'printer_id' in userdata:
                printer_id = userdata['printer_id']
                report_topic = f"device/{printer_id}/report"
                request_topic = f"device/{printer_id}/request"
                logger.info(f"Subscribing to topics: {report_topic}, {request_topic}")
                client.subscribe([(report_topic, 0), (request_topic, 0)])
                # Request full printer status after subscribing
                self.request_full_printer_status(printer_id)
        else:
            logger.error(f"MQTT Connection failed: {rc_codes.get(rc, f'Unknown error {rc}')}")
            self.mqtt_connected = False

    def on_mqtt_message(self, client, userdata, msg):
        """Handle MQTT messages"""
        try:
            logger.debug(f"Received MQTT message on topic {msg.topic}")
            
            # Extract device ID from topic
            topic_parts = msg.topic.split('/')
            if len(topic_parts) >= 3:
                device_id = topic_parts[1]
                logger.debug(f"Message for device: {device_id}")
                
                # Parse message payload
                try:
                    payload = msg.payload.decode('utf-8')
                    data = json.loads(payload)
                    logger.debug(f"Parsed message payload: {data}")
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse MQTT message as JSON: {msg.payload}")
                    return
                except UnicodeDecodeError:
                    logger.error(f"Failed to decode MQTT message as UTF-8")
                    return
                
                # Initialize or get existing printer data
                if device_id not in self.printer_data:
                    self.printer_data[device_id] = {
                        'device': {
                            'status': 'OFFLINE',
                            'hotend_temp': 0.0,
                            'bed_temp': 0.0,
                            'chamber_temp': 0.0,
                            'target_nozzle_temp': 0.0,
                            'target_bed_temp': 0.0
                        },
                        'print': {
                            'gcode_state': 'IDLE',
                            'mc_percent': 0.0,
                            'mc_remaining_time': 0,
                            'current_layer': 0,
                            'total_layers': 0
                        }
                    }
                
                if device_id not in self.temperature_data:
                    self.temperature_data[device_id] = {
                        'temperatures': {
                            'hotend': 0.0,
                            'bed': 0.0,
                            'chamber': 0.0
                        },
                        'targets': {
                            'hotend': 0.0,
                            'bed': 0.0
                        }
                    }
                
                # Get current values to preserve them if not updated
                current_printer_data = self.printer_data[device_id]
                current_temp_data = self.temperature_data[device_id]
                
                # Extract print data
                print_data = data.get('print', {})
                
                # Update temperatures from direct fields if provided
                if 'nozzle_temper' in print_data:
                    temp = float(print_data['nozzle_temper'])
                    if temp > 0 or temp == 0 and 'nozzle_target_temper' in print_data:  # Only update if >0 or if we have target temp
                        current_printer_data['device']['hotend_temp'] = temp
                        current_temp_data['temperatures']['hotend'] = temp
                
                if 'bed_temper' in print_data:
                    temp = float(print_data['bed_temper'])
                    current_printer_data['device']['bed_temp'] = temp
                    current_temp_data['temperatures']['bed'] = temp
                
                if 'chamber_temper' in print_data:
                    temp = float(print_data['chamber_temper'])
                    current_printer_data['device']['chamber_temp'] = temp
                    current_temp_data['temperatures']['chamber'] = temp
                
                # Update target temperatures if provided
                if 'nozzle_target_temper' in print_data:
                    temp = float(print_data['nozzle_target_temper'])
                    current_printer_data['device']['target_nozzle_temp'] = temp
                    current_temp_data['targets']['hotend'] = temp
                
                if 'bed_target_temper' in print_data:
                    temp = float(print_data['bed_target_temper'])
                    current_printer_data['device']['target_bed_temp'] = temp
                    current_temp_data['targets']['bed'] = temp
                
                # Check for nested device.nozzle temperature data
                if 'device' in print_data:
                    device_data = print_data['device']
                    if 'nozzle' in device_data:
                        nozzle_data = device_data['nozzle']
                        if '0' in nozzle_data and 'temp' in nozzle_data['0']:
                            temp = float(nozzle_data['0']['temp'])
                            if temp > 0:  # Only update if temperature is greater than 0
                                current_printer_data['device']['hotend_temp'] = temp
                                current_temp_data['temperatures']['hotend'] = temp
                
                # Update print status if provided
                if 'gcode_state' in print_data:
                    current_printer_data['print']['gcode_state'] = print_data['gcode_state']
                if 'mc_percent' in print_data:
                    current_printer_data['print']['mc_percent'] = float(print_data['mc_percent'])
                if 'mc_remaining_time' in print_data:
                    current_printer_data['print']['mc_remaining_time'] = int(print_data['mc_remaining_time'])
                if 'current_layer' in print_data:
                    current_printer_data['print']['current_layer'] = int(print_data['current_layer'])
                if 'total_layers' in print_data:
                    current_printer_data['print']['total_layers'] = int(print_data['total_layers'])
                
                # Update the status based on whether we're receiving temperature data
                if any([
                    current_printer_data['device']['hotend_temp'] > 0,
                    current_printer_data['device']['bed_temp'] > 0,
                    current_printer_data['device']['chamber_temp'] > 0,
                    current_printer_data['device']['target_nozzle_temp'] > 0,
                    current_printer_data['device']['target_bed_temp'] > 0
                ]):
                    current_printer_data['device']['status'] = 'ACTIVE'
                
                logger.debug(f"Updated printer data for {device_id}: {current_printer_data}")
                logger.debug(f"Updated temperature data for {device_id}: {current_temp_data}")
                
        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}", exc_info=True)

    def on_mqtt_disconnect(self, client, userdata, rc):
        """Callback when client disconnects from MQTT broker"""
        logger.warning(f"MQTT Disconnected with result code: {rc}")
        self.mqtt_connected = False

    def on_mqtt_subscribe(self, client, userdata, mid, granted_qos):
        """Callback when subscription is confirmed"""
        logger.info(f"MQTT Subscription confirmed. Message ID: {mid}, QoS: {granted_qos}")

    def on_mqtt_log(self, client, userdata, level, buf):
        """Callback for MQTT client logging"""
        logger.debug(f"MQTT Log: {buf}")

    def reconnect_mqtt(self):
        """Attempt to reconnect MQTT if disconnected"""
        if not self.mqtt_client:
            logger.info("No MQTT client exists, setting up new connection")
            return self.setup_mqtt()
            
        if self.mqtt_connected:
            logger.info("MQTT already connected, no need to reconnect")
            return True
            
        try:
            logger.info("Attempting to reconnect MQTT client")
            self.mqtt_client.reconnect()
            return True
        except Exception as e:
            logger.error(f"Failed to reconnect MQTT: {e}", exc_info=True)
            # If reconnect fails, try a full setup
            logger.info("Reconnect failed, attempting full MQTT setup")
            return self.setup_mqtt()
            
    def initialize_from_stored_printers(self):
        """Lädt alle gespeicherten Cloud-Drucker und stellt MQTT-Verbindungen her"""
        logger.info("Initializing Bambu Cloud service from stored printers")
        try:
            # Prüfe zuerst, ob lokale Bambu Cloud-Drucker vorhanden sind
            stored_printers = getPrinters()
            cloud_printers = [p for p in stored_printers if p.get('type') == 'CLOUD' or 
                             (p.get('type') == 'BAMBULAB' and p.get('isCloud') == True)]
            
            if not cloud_printers:
                logger.info("No local Bambu Cloud printers found in printers directory, skipping cloud initialization")
                return
                
            logger.info(f"Found {len(cloud_printers)} local Bambu Cloud printers, proceeding with cloud initialization")
            
            # Prüfe, ob wir gültige Zugangsdaten haben
            config_status = self.load_config()
            if not config_status.get('success'):
                logger.warning("No valid cloud credentials found, skipping cloud printer initialization")
                return
                
            # Hole Cloud-Drucker
            cloud_printers_api = self.get_cloud_printers_internal()
            if not cloud_printers_api:
                logger.info("No cloud printers found in Bambu API")
                return
                
            # Stelle MQTT-Verbindung her
            mqtt_setup_success = self.setup_mqtt()
            logger.info(f"MQTT setup {'successful' if mqtt_setup_success else 'failed'}")
            
            # Verbinde mit jedem Drucker
            for printer in cloud_printers_api:
                try:
                    printer_id = printer.get('dev_id')
                    if printer_id:
                        logger.info(f"Setting up MQTT for cloud printer: {printer.get('name')} (ID: {printer_id})")
                        self.setup_mqtt_for_printer(printer_id)
                except Exception as e:
                    logger.error(f"Error setting up MQTT for cloud printer: {e}", exc_info=True)
                    
            logger.info(f"Initialized {len(cloud_printers_api)} cloud printers")
            
        except Exception as e:
            logger.error(f"Error initializing Bambu Cloud service: {e}", exc_info=True)

    def emergency_stop_printer(self, printer_id):
        """Sendet einen Notfall-Stopp-Befehl an einen Bambu Cloud Drucker"""
        try:
            if not self.mqtt_client or not self.mqtt_connected:
                logger.error("MQTT client not connected, cannot send emergency stop")
                return False
                
            # Sende M112 Notfall-Stopp-Befehl
            request_topic = f"device/{printer_id}/request"
            command = {
                "print": {
                    "sequence_id": str(int(time.time())),
                    "command": "gcode_line",
                    "param": "M112",  # Emergency Stop Gcode
                    "user_id": "PrintCam"
                }
            }
            
            logger.info(f"Sending emergency stop command to cloud printer {printer_id}")
            result = self.mqtt_client.publish(request_topic, json.dumps(command))
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"Emergency stop command sent successfully to cloud printer {printer_id}")
                return True
            else:
                logger.error(f"Failed to send emergency stop command: {result.rc}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending emergency stop command to cloud printer: {e}", exc_info=True)
            return False

# Global instance
bambu_cloud_service = BambuCloudService() 