import logging
import requests
from pathlib import Path
import json
import os
from telegram.ext import Updater, CommandHandler
from telegram import ParseMode
import time

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
            logger.info(f"Start command received from chat_id: {update.effective_chat.id}")
            chat_id = update.effective_chat.id
            
            # Speichere chat_id, token und aktiviere Benachrichtigungen
            self.config['chat_id'] = chat_id
            self.config['token'] = os.getenv('TELEGRAM_BOT_TOKEN')  # Token speichern
            self.config['notifications_enabled'] = True
            self.save_config()
            
            welcome_message = (
                "🖨 *BambuCam Telegram Bot*\n\n"
                "Bot wurde erfolgreich eingerichtet!\n"
                "Sie erhalten ab jetzt Benachrichtigungen über Ihre Drucke.\n\n"
                "Verfügbare Befehle:\n"
                "/help - Zeigt diese Hilfe an"
            )
            
            sent = update.message.reply_text(
                welcome_message,
                parse_mode=ParseMode.MARKDOWN
            )
            logger.info(f"Welcome message sent to chat_id {chat_id}")
            
        except Exception as e:
            logger.error(f"Error in start command: {e}", exc_info=True)
            raise

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

    def send_notification(self, message):
        """Sendet eine Telegram Nachricht"""
        try:
            # Prüfe ob Bot initialisiert ist, wenn nicht versuche Neustart
            if not self.is_ready or not self.bot:
                token = self.config.get('token')  # Token aus Config laden
                if token:
                    logger.info("Bot nicht initialisiert, versuche Neustart...")
                    self.init_bot(token)  # Token übergeben

            if not self.bot or not self.config.get('chat_id') or not self.is_ready:
                logger.error("Telegram nicht eingerichtet oder Bot nicht initialisiert")
                return False
                
            chat_id = self.config['chat_id']
            self.bot.bot.send_message(
                chat_id=chat_id,
                text=message,
                parse_mode=ParseMode.MARKDOWN
            )
            
            logger.info(f"Telegram Nachricht gesendet: {message}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending Telegram message: {e}")
            return False

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

    def is_configured(self):
        """Prüft ob der Bot konfiguriert ist"""
        try:
            has_chat_id = bool(self.config.get('chat_id'))
            is_enabled = bool(self.config.get('notifications_enabled'))
            logger.debug(f"Bot configuration status: chat_id={has_chat_id}, enabled={is_enabled}")
            return has_chat_id and is_enabled  # Beide Bedingungen müssen erfüllt sein
        except Exception as e:
            logger.error(f"Error checking configuration: {e}")
            return False

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