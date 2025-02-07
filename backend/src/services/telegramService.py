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

    def init_bot(self):
        """Initialisiert den Telegram Bot"""
        try:
            token = os.getenv('TELEGRAM_BOT_TOKEN')
            if not token:
                logger.warning("TELEGRAM_BOT_TOKEN nicht gesetzt")
                return False

            # Extrahiere Chat-ID aus dem Token
            try:
                chat_id = token.split(':')[0]
                self.config['chat_id'] = chat_id
                self.save_config()
            except Exception as e:
                logger.error(f"Error extracting chat ID from token: {e}")
                return False
                
            self.bot = Updater(token)
            
            # Setze Profilbild
            try:
                # Angepasster Pfad zum Logo
                logo_path = '/home/Print-Cam/frontend/public/logo.png'
                with open(logo_path, 'rb') as photo:
                    self.bot.bot.set_chat_photo(
                        chat_id=f'@{self.bot.bot.get_me().username}',
                        photo=photo
                    )
                logger.info("Bot profile photo updated")
            except Exception as e:
                logger.warning(f"Could not set bot profile photo: {e}")
            
            # Kommandos registrieren
            dp = self.bot.dispatcher
            dp.add_handler(CommandHandler("help", self.help_command))
            
            # Bot starten
            self.bot.start_polling()
            logger.info("Telegram Bot gestartet")

            # Sende sofort eine Willkommensnachricht
            try:
                welcome_message = (
                    "🖨 *BambuCam Telegram Bot*\n\n"
                    "Bot wurde erfolgreich eingerichtet!\n"
                    "Sie erhalten ab jetzt Benachrichtigungen über Ihre Drucke.\n\n"
                    "Verfügbare Befehle:\n"
                    "/help - Zeigt diese Hilfe an"
                )
                
                self.bot.bot.send_message(
                    chat_id=chat_id,
                    text=welcome_message,
                    parse_mode=ParseMode.MARKDOWN
                )
                
                self.is_ready = True
                logger.info(f"Telegram Bot setup completed with chat_id: {chat_id}")
                return True
                
            except Exception as e:
                logger.error(f"Error sending welcome message: {e}")
                return False
            
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

    def load_config(self):
        """Lädt die Konfiguration"""
        if self.config_file.exists():
            with open(self.config_file) as f:
                self.config = json.load(f)
        else:
            self.config = {
                'chat_id': None
            }

    def save_config(self):
        """Speichert die Konfiguration"""
        with open(self.config_file, 'w') as f:
            json.dump(self.config, f)

    def send_notification(self, message):
        """Sendet eine Telegram Nachricht"""
        try:
            if not self.bot or not self.config.get('chat_id') or not self.is_ready:
                logger.error("Telegram nicht eingerichtet")
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

# Globale Instanz
telegram_service = TelegramService() 