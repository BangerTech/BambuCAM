import logging
import webbrowser
import subprocess
from pathlib import Path
import json
import time

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
            # Für den Test: Status aus Config lesen
            return self.config.get('is_logged_in', False)
        except Exception as e:
            logger.error(f"WhatsApp login check error: {e}")
            return False

    def start_login(self):
        """Startet den WhatsApp Login-Prozess"""
        try:
            # Öffne WhatsApp Web im Standard-Browser des Systems
            url = 'https://web.whatsapp.com'
            
            try:
                # Versuche zuerst den Standard-Browser zu nutzen
                webbrowser.open_new(url)
            except Exception as e:
                logger.warning(f"Fallback to generic browser open: {e}")
                # Fallback: Versuche generischen Browser-Start
                webbrowser.open(url)
            
            # Für den Test: Nach 10 Sekunden automatisch als eingeloggt markieren
            def auto_login():
                time.sleep(10)
                self.config['is_logged_in'] = True
                self.save_config()
                logger.info("Auto-login completed after 10 seconds")
            
            import threading
            threading.Thread(target=auto_login).start()
            
            return {
                'success': True,
                'message': 'WhatsApp Web wurde geöffnet. Bitte warten Sie einen Moment...'
            }
        except Exception as e:
            logger.error(f"WhatsApp login error: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_status(self):
        """Gibt den aktuellen Login-Status zurück"""
        return {
            'success': True,
            'is_logged_in': self.is_logged_in()
        }

    def is_windows(self):
        """Prüft ob das System Windows ist"""
        import platform
        return platform.system().lower() == 'windows'

    def is_macos(self):
        """Prüft ob das System macOS ist"""
        import platform
        return platform.system().lower() == 'darwin'

    def save_number(self, number):
        """Speichert die WhatsApp Nummer"""
        try:
            if not self.is_logged_in():
                return {
                    'success': False,
                    'needs_login': True,
                    'message': 'WhatsApp ist nicht eingeloggt. Bitte zuerst QR-Code scannen.'
                }, 401
            
            self.config['number'] = number
            self.config['is_logged_in'] = True  # Setze Login-Status
            self.save_config()
            logger.info(f"Saved WhatsApp number: {number}")
            
            return {
                'success': True,
                'message': 'WhatsApp Nummer erfolgreich gespeichert'
            }, 200
            
        except Exception as e:
            logger.error(f"Error saving WhatsApp number: {e}")
            return {
                'success': False,
                'error': str(e)
            }, 500

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