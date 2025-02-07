import logging
import webbrowser
from pathlib import Path
import json

logger = logging.getLogger(__name__)

class WhatsAppService:
    def __init__(self):
        self.config_file = Path("config/whatsapp.json")
        self.config_file.parent.mkdir(exist_ok=True)
        self.load_config()

    def load_config(self):
        if self.config_file.exists():
            with open(self.config_file) as f:
                self.config = json.load(f)
        else:
            self.config = {
                'is_logged_in': False,
                'number': None
            }

    def save_config(self):
        with open(self.config_file, 'w') as f:
            json.dump(self.config, f)

    def is_logged_in(self):
        """Prüft ob WhatsApp eingerichtet ist"""
        try:
            # Hier würde die echte WhatsApp-Prüfung kommen
            # Für den Test immer False zurückgeben, damit der Login-Flow getestet werden kann
            return False
        except Exception as e:
            logger.error(f"WhatsApp login check error: {e}")
            return False

    def save_number(self, number):
        """Speichert die WhatsApp Nummer"""
        if not self.is_logged_in():
            raise Exception("WhatsApp not logged in")
        
        self.config['number'] = number
        self.save_config()
        logger.info(f"Saved WhatsApp number: {number}")

    def start_login(self):
        """Startet den WhatsApp Login-Prozess"""
        try:
            # Öffne WhatsApp Web in einem neuen Browser-Fenster
            webbrowser.open('https://web.whatsapp.com', new=2)
            
            # Setze Login-Status zurück
            self.config['is_logged_in'] = False
            self.save_config()
            
            return "QR-Code wird im Browser angezeigt"
        except Exception as e:
            logger.error(f"WhatsApp login error: {e}")
            raise

    def send_notification(self, message):
        """Sendet eine WhatsApp Nachricht"""
        if not self.is_logged_in():
            raise Exception("WhatsApp not logged in")
            
        number = self.config.get('number')
        if not number:
            raise Exception("No WhatsApp number configured")
            
        # Hier würde die echte Nachricht gesendet werden
        logger.info(f"Would send WhatsApp message to {number}: {message}")

# Globale Instanz
whatsapp_service = WhatsAppService() 