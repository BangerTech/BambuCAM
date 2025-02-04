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
        """Get a list of devices associated with the account."""
        if not self.token:
            return []
            
        try:
            response = self.session.get(
                "https://cloud.bambulab.com/api/user-printers"  # <-- Geändert
            )
            
            logger.info(f"Get cloud printers response: {response.status_code} - {response.text}")
            
            if response.status_code == 200:
                devices = response.json()
                return [{
                    "name": device["name"],
                    "online": device["online"],
                    "id": device["dev_id"],
                    "status": device["print_status"],
                    "model": device["dev_model_name"],
                    "streamUrl": f"https://api.bambulab.com/{self.region.value}/devices/{device['dev_id']}/stream"
                } for device in devices]
                
            return []
            
        except Exception as e:
            logger.error(f"Failed to get cloud devices: {e}")
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