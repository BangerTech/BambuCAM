import requests
import logging
from datetime import datetime
from enum import Enum
from pathlib import Path
import json

logger = logging.getLogger(__name__)

class Region(Enum):
    China = "china"
    Europe = "europe" 
    NorthAmerica = "north_america"
    AsiaPacific = "asia_pacific"
    Other = "other"

class BambuCloudService:
    def __init__(self):
        self.base_url = "https://api.bambulab.com"
        self.session = requests.Session()
        self.config_file = Path("config/bambu_cloud.json")
        self.config_file.parent.mkdir(exist_ok=True)
        self.load_config()

    def load_config(self):
        """Lädt die gespeicherten Cloud Credentials"""
        try:
            if self.config_file.exists():
                with open(self.config_file) as f:
                    self.config = json.load(f)
                    # Token aus Config laden und Session wiederherstellen
                    if self.config.get('token'):
                        self.token = self.config['token']
                        self.session.headers.update({
                            "Authorization": f"Bearer {self.token}"
                        })
                        logger.info("Loaded cloud credentials from config")
            else:
                self.config = {}
                self.token = None
        except Exception as e:
            logger.error(f"Error loading cloud config: {e}")
            self.config = {}
            self.token = None

    def save_config(self):
        """Speichert die Cloud Credentials"""
        try:
            self.config['token'] = self.token
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f)
            logger.info("Saved cloud credentials to config")
        except Exception as e:
            logger.error(f"Error saving cloud config: {e}")

    def login(self, email: str, password: str, verification_code: str = None):
        """Login mit Bambulab Account"""
        try:
            url = f"{self.base_url}/v1/user-service/user/login"
            
            # Wenn ein Verification Code vorhanden ist, nutzen wir diesen
            if verification_code:
                data = {
                    "account": email,
                    "code": verification_code,
                    "loginType": "verifyCode"
                }
            else:
                # Erst Code anfordern
                code_url = f"{self.base_url}/v1/user-service/user/sendemail/code"
                code_data = {
                    "email": email,
                    "type": "codeLogin"
                }
                self.session.post(code_url, json=code_data)
                
                # Dann mit Passwort versuchen
                data = {
                    "account": email,
                    "password": password
                }
            
            logger.info(f"Attempting login to {url}")
            logger.info(f"Request data: {data}")
            
            response = self.session.post(url, json=data)
            
            logger.info(f"Response status: {response.status_code}")
            logger.info(f"Response headers: {dict(response.headers)}")
            logger.info(f"Response body: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Wenn wir einen leeren Token bekommen, brauchen wir 2FA
                if not data.get("accessToken"):
                    return {
                        "success": False,
                        "error": "2FA erforderlich. Bitte prüfen Sie Ihre E-Mail für den Code.",
                        "needs_verification": True
                    }
                    
                self.token = data.get("accessToken")
                if self.token:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.token}"
                    })
                    self.save_config()  # Token speichern
                    return {"success": True, "token": self.token}
            
            error_msg = f"Login failed: Status {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }
            
        except Exception as e:
            error_msg = f"Login error: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}

    def get_cloud_printers(self):
        """Holt die Liste der Cloud-Drucker"""
        try:
            if not self.token:
                logger.warning("No token available for cloud printers request")
                return []

            headers = {
                'Authorization': f'Bearer {self.token}'
            }
            
            response = requests.get(
                f"{self.base_url}/v1/iot-service/api/user/bind",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Get cloud printers response: {response.status_code} - {data}")
                
                if data.get('devices'):
                    # Formatiere die Drucker ins richtige Format
                    return [{
                        'id': printer['dev_id'],
                        'name': printer['name'],
                        'model': printer['dev_product_name'],
                        'status': printer['print_status'],
                        'online': printer['online'],
                        'type': 'cloud',  # Wichtig: Markiere als Cloud-Drucker
                        'access_code': printer['dev_access_code']
                    } for printer in data['devices']]
            
            logger.warning(f"Failed to get cloud printers: {response.status_code}")
            return []
            
        except Exception as e:
            logger.error(f"Error getting cloud printers: {e}")
            return []

    def get_profile(self):
        """Get the account profile for the logged-in user."""
        if not self.token:
            return None
            
        try:
            response = self.session.get(
                "https://cloud.bambulab.com/api/user-profile"
            )
            
            if response.status_code == 200:
                return response.json()
                
            return None
            
        except Exception as e:
            logger.error(f"Failed to get profile: {e}")
            return None

    def get_stream_url(self, device_id):
        """Hole Stream URL für einen Cloud-Drucker"""
        if not self.token:
            return None
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(
                f"https://api.bambulab.com/devices/{device_id}/stream", 
                headers=headers
            )
            return response.json().get("url")
        except Exception as e:
            logger.error(f"Failed to get stream URL: {e}")
            return None

    def get_printers(self):
        """Holt Liste der verfügbaren Cloud-Drucker"""
        try:
            if not self.token:
                return []

            headers = {
                'Authorization': f"Bearer {self.token}"
            }
            
            response = requests.get(f"{self.base_url}/iot-service/api/user/printers", headers=headers)
            data = response.json()
            
            if response.ok and data.get('message') == 'success':
                return [{
                    'name': printer.get('name', 'Cloud Printer'),
                    'ip': printer.get('dev_id'),  # Wir nutzen dev_id als "IP"
                    'type': 'CLOUD',
                    'model': printer.get('model'),
                    'online': printer.get('online', False)
                } for printer in data.get('printers', [])]
            return []
        except Exception as e:
            logger.error(f"Error getting cloud printers: {e}")
            return [] 