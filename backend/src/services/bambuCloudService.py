import requests
import logging
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)

class Region(Enum):
    China = "china"
    Europe = "europe" 
    NorthAmerica = "north_america"
    AsiaPacific = "asia_pacific"
    Other = "other"

class BambuCloudService:
    def __init__(self, region="global"):
        self.token = None
        self.session = requests.Session()
        # Base URL basierend auf Region
        self.base_url = "https://api.bambulab.cn" if region == "china" else "https://api.bambulab.com"
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
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
            response = self.make_request('GET', 'v1/iot-service/api/user/bind')
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