import logging
import requests
from pathlib import Path
import json
import os
from telegram.ext import Updater, CommandHandler
from telegram import ParseMode
import time
from src.config import Config

logger = logging.getLogger(__name__)

class TelegramService:
    def __init__(self):
        self.config_file = Path("config/telegram.json")
        self.config_file.parent.mkdir(exist_ok=True)
        self.load_config()
        self.bot = None
        self.is_ready = False
        
        # Versuche Bot neu zu starten wenn Token in der Config existiert
        if self.config.get('token'):
            logger.info("Found existing token, trying to restart bot...")
            self.init_bot(self.config['token'])

        self.notifications_file = os.path.join(Config.DATA_DIR, 'notifications', 'notifications.json')

    def init_bot(self, token=None):
        """Initialisiert den Telegram Bot"""
        try:
            # Wenn Bot bereits läuft, nicht neu starten
            if self.is_ready and self.bot:
                logger.info("Bot is already running")
                return {
                    'success': True,
                    'botUsername': self.bot.bot.username
                }

            if token:
                os.environ['TELEGRAM_BOT_TOKEN'] = token
                self.config['token'] = token
                self.save_config()
                logger.info("Token saved to config")
            else:
                # Versuche Token aus Config zu laden
                token = self.config.get('token')
                if token:
                    os.environ['TELEGRAM_BOT_TOKEN'] = token
                    logger.info("Token loaded from config")

            token = os.getenv('TELEGRAM_BOT_TOKEN')
            if not token:
                logger.warning("TELEGRAM_BOT_TOKEN nicht gesetzt")
                return False

            self.bot = Updater(token)
            logger.info(f"Bot username: {self.bot.bot.username}")
            
            # Kommandos registrieren
            dp = self.bot.dispatcher
            dp.add_handler(CommandHandler("help", self.help_command))
            dp.add_handler(CommandHandler("start", self.start_command))
            
            # Bot starten
            self.bot.start_polling(drop_pending_updates=True)
            logger.info("Telegram Bot gestartet und polling aktiviert")
            
            self.is_ready = True
            return {
                'success': True,
                'botUsername': self.bot.bot.username
            }
            
        except Exception as e:
            logger.error(f"Telegram Bot init error: {e}")
            return False

    def help_command(self, update, context):
        """Handler für /help Kommando"""
        message = (
            "🔍 *Verfügbare Befehle:*\n\n"
            "/help - Diese Hilfe anzeigen\n\n"
            "Sie erhalten automatisch Benachrichtigungen über:\n"
            "✅ Abgeschlossene Drucke\n"
            "❌ Fehlgeschlagene Drucke\n" 
            "⚠️ Drucker-Fehler"
        )
        
        update.message.reply_text(message, parse_mode=ParseMode.MARKDOWN)

    def start_command(self, update, context):
        """Handler für /start Kommando"""
        try:
            chat_id = update.effective_chat.id
            logger.info(f"Start command received from chat_id: {chat_id}")
            
            # Lade aktuelle Einstellungen
            if not os.path.exists(self.notifications_file):
                logger.error("Notifications file not found")
                return
            
            try:
                with open(self.notifications_file, 'r') as f:
                    settings = json.load(f)
                    
                # Stelle sicher dass die Telegram-Struktur existiert
                if 'telegram' not in settings:
                    settings['telegram'] = {}
                    
                # Initialisiere chat_ids wenn nicht vorhanden
                if 'chat_ids' not in settings['telegram']:
                    settings['telegram']['chat_ids'] = []
                    
                # Füge chat_id hinzu wenn noch nicht vorhanden
                if chat_id not in settings['telegram']['chat_ids']:
                    settings['telegram']['chat_ids'].append(chat_id)
                    logger.info(f"Added new chat_id: {chat_id}")
                    
                    # Speichere die aktualisierten Einstellungen
                    with open(self.notifications_file, 'w') as f:
                        json.dump(settings, f, indent=2)
                    logger.info("Updated notifications.json with new chat_id")
                    
                # Sende Willkommensnachricht
                welcome_message = (
                    "🖨 *BambuCam Telegram Bot*\n\n"
                    "Bot wurde erfolgreich eingerichtet!\n"
                    "Sie erhalten ab jetzt Benachrichtigungen über Ihre Drucke.\n\n"
                    "Verfügbare Befehle:\n"
                    "/help - Zeigt diese Hilfe an"
                )
                
                update.message.reply_text(
                    welcome_message,
                    parse_mode=ParseMode.MARKDOWN
                )
                logger.info(f"Welcome message sent to chat_id {chat_id}")
                
            except json.JSONDecodeError as e:
                logger.error(f"Error reading notifications file: {e}")
            except Exception as e:
                logger.error(f"Error in start command: {e}")
                
        except Exception as e:
            logger.error(f"Critical error in start command: {e}", exc_info=True)

    def load_config(self):
        """Lädt die Konfiguration"""
        if self.config_file.exists():
            with open(self.config_file) as f:
                self.config = json.load(f)
        else:
            self.config = {
                'chat_id': None,
                'notifications_enabled': False  # Neues Feld für den Status
            }

    def save_config(self):
        """Speichert die Konfiguration"""
        with open(self.config_file, 'w') as f:
            json.dump(self.config, f)

    def is_configured(self):
        try:
            if os.path.exists(self.notifications_file):
                with open(self.notifications_file, 'r') as f:
                    settings = json.load(f)
                    return bool(settings.get('telegram', {}).get('token'))
            return False
        except Exception as e:
            logger.error(f"Error checking telegram configuration: {e}")
            return False
            
    def get_settings(self):
        try:
            if os.path.exists(self.notifications_file):
                with open(self.notifications_file, 'r') as f:
                    return json.load(f).get('telegram', {})
            return {}
        except Exception as e:
            logger.error(f"Error reading telegram settings: {e}")
            return {}
            
    def send_notification(self, message):
        try:
            settings = self.get_settings()
            if not settings.get('enabled'):
                return False
                
            token = settings.get('token')
            chat_ids = settings.get('chat_ids', [])
            
            if not token or not chat_ids:
                return False
                
            for chat_id in chat_ids:
                url = f"https://api.telegram.org/bot{token}/sendMessage"
                data = {
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "Markdown"
                }
                response = requests.post(url, json=data)
                if not response.ok:
                    logger.error(f"Error sending telegram message: {response.text}")
                    
            return True
        except Exception as e:
            logger.error(f"Error sending telegram notification: {e}")
            return False
            
    def send_welcome_message(self, chat_id):
        """Sendet Willkommensnachricht wenn Bot gestartet wird"""
        welcome_msg = """🖨 BambuCam Telegram Bot

Bot wurde erfolgreich eingerichtet!
Sie erhalten ab jetzt Benachrichtigungen über Ihre Drucke.

Verfügbare Befehle:
/help - Zeigt diese Hilfe an"""
        
        try:
            settings = self.get_settings()
            token = settings.get('token')
            
            if token and chat_id:
                url = f"https://api.telegram.org/bot{token}/sendMessage"
                data = {
                    "chat_id": chat_id,
                    "text": welcome_msg,
                    "parse_mode": "Markdown"
                }
                requests.post(url, json=data)
        except Exception as e:
            logger.error(f"Error sending welcome message: {e}")
            
    def send_status_notification(self, enabled: bool):
        """Sendet eine Benachrichtigung wenn der Status geändert wird"""
        try:
            if not os.path.exists(self.notifications_file):
                return
            
            with open(self.notifications_file, 'r') as f:
                settings = json.load(f)
            
            if 'chat_ids' not in settings.get('telegram', {}):
                return
            
            message = "�� Benachrichtigungen wurden aktiviert" if enabled else "🔕 Benachrichtigungen wurden deaktiviert"
            
            for chat_id in settings['telegram']['chat_ids']:
                try:
                    self.bot.send_message(
                        chat_id=chat_id,
                        text=message,
                        parse_mode=ParseMode.MARKDOWN
                    )
                    logger.info(f"Status notification sent to {chat_id}")
                except Exception as e:
                    logger.error(f"Error sending status notification to {chat_id}: {e}")
                
        except Exception as e:
            logger.error(f"Error sending status notification: {e}")

    def wait_for_setup(self, timeout=30):
        """Wartet bis der Bot eingerichtet ist"""
        start_time = time.time()
        while not self.is_ready and time.time() - start_time < timeout:
            time.sleep(1)
            if self.is_ready:
                return True
                
        # Timeout - gib hilfreiche Fehlermeldung zurück
        bot_info = self.bot.bot.get_me() if self.bot else None
        if bot_info:
            raise TimeoutError(
                f"Setup timeout - please open https://t.me/{bot_info.username} "
                "and send /start to complete setup"
            )
        else:
            raise TimeoutError("Setup timeout - please send /start to the bot")

    def disable(self):
        """Deaktiviert die Benachrichtigungen"""
        try:
            # Erst Nachricht senden, dann deaktivieren
            self.send_notification("🔕 Benachrichtigungen wurden deaktiviert")
            self.config['notifications_enabled'] = False
            self.save_config()
            return True
        except Exception as e:
            logger.error(f"Error disabling notifications: {e}")
            return False

    def enable(self):
        """Aktiviert die Benachrichtigungen"""
        try:
            self.config['notifications_enabled'] = True
            self.save_config()
            # Nachricht nach Aktivierung senden
            self.send_notification("🔔 Benachrichtigungen wurden wieder aktiviert!")
            return True
        except Exception as e:
            logger.error(f"Error enabling notifications: {e}")
            return False

# Globale Instanz
telegram_service = TelegramService() 