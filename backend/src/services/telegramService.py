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
        self.init_bot()

    def init_bot(self):
        """Initialisiert den Telegram Bot"""
        try:
            token = os.getenv('TELEGRAM_BOT_TOKEN')
            if not token:
                logger.warning("TELEGRAM_BOT_TOKEN nicht gesetzt")
                return
                
            self.bot = Updater(token)
            
            # Kommandos registrieren
            dp = self.bot.dispatcher
            dp.add_handler(CommandHandler("start", self.start_command))
            dp.add_handler(CommandHandler("help", self.help_command))
            
            # Bot starten
            self.bot.start_polling()
            logger.info("Telegram Bot gestartet")
            
            # Automatisch /start ausführen
            self.auto_start()
            
        except Exception as e:
            logger.error(f"Telegram Bot init error: {e}")

    def auto_start(self):
        """Bereitet den Bot für den ersten Start vor"""
        try:
            # Warte kurz bis der Bot gestartet ist
            time.sleep(2)
            logger.info("Bot ist bereit für Benutzerinteraktion")
        except Exception as e:
            logger.error(f"Auto-start error: {e}")

    def start_command(self, update, context):
        """Handler für /start Kommando"""
        try:
            # Wenn es ein echtes Update ist, nutze die Chat ID daraus
            if update and update.effective_chat:
                chat_id = update.effective_chat.id
                self.config['chat_id'] = chat_id
                self.save_config()
                
                message = (
                    "🖨 *BambuCam Telegram Bot*\n\n"
                    "Bot wurde erfolgreich eingerichtet!\n"
                    "Sie erhalten ab jetzt Benachrichtigungen über Ihre Drucke.\n\n"
                    "Verfügbare Befehle:\n"
                    "/help - Zeigt diese Hilfe an"
                )
                
                update.message.reply_text(message, parse_mode=ParseMode.MARKDOWN)
            else:
                # Auto-Start: Warte auf ersten /start Befehl vom Benutzer
                logger.info("Warte auf /start Befehl vom Benutzer...")
            
        except Exception as e:
            logger.error(f"Start command error: {e}")

    def help_command(self, update, context):
        """Handler für /help Kommando"""
        message = (
            "🔍 *Verfügbare Befehle:*\n\n"
            "/start - Bot einrichten\n"
            "/help - Diese Hilfe anzeigen"
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
            if not self.bot or not self.config.get('chat_id'):
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

# Globale Instanz
telegram_service = TelegramService() 