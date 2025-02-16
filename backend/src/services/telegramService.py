import logging
import requests
from pathlib import Path
import json
import os
from telegram.ext import Updater, CommandHandler
from telegram import ParseMode
import time
from src.config import Config
import telegram

logger = logging.getLogger(__name__)

class TelegramService:
    def __init__(self):
        """Initializes the Telegram Service"""
        self.config_file = Path('data/notifications/notifications.json')
        self.notifications_file = 'data/notifications/notifications.json'
        self.bot = None
        self.updater = None
        self.is_ready = False
        
        # Try to initialize bot if configuration exists
        try:
            settings = self.get_settings()
            if settings.get('token'):
                self.initialize_bot(settings['token'])
        except Exception as e:
            logger.error(f"Error initializing telegram bot: {e}")

    def initialize_bot(self, token):
        """Initializes the bot with the given token"""
        try:
            self.bot = telegram.Bot(token=token)
            self.updater = Updater(token, use_context=True)
            
            # Register handlers
            dp = self.updater.dispatcher
            dp.add_handler(CommandHandler("start", self.start_command))
            dp.add_handler(CommandHandler("help", self.help_command))
            
            # Start bot
            self.updater.start_polling()
            self.is_ready = True
            logger.info("Telegram bot initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize telegram bot: {e}")
            self.is_ready = False

    def help_command(self, update, context):
        """Handler for /help command"""
        message = (
            "🔍 *Available Commands:*\n\n"
            "/help - Show this help\n\n"
            "You will receive automatic notifications for:\n"
            "✅ Completed prints\n"
            "❌ Failed prints\n" 
            "⚠️ Printer errors"
        )
        
        update.message.reply_text(message, parse_mode=ParseMode.MARKDOWN)

    def start_command(self, update, context):
        """Handler for /start command"""
        try:
            chat_id = update.effective_chat.id
            logger.info(f"Start command received from chat_id: {chat_id}")
            
            # Sende sofort die Willkommensnachricht
            welcome_message = (
                "🖨 *BambuCam Telegram Bot*\n\n"
                "Bot setup successful!\n"
                "You will now receive notifications about your prints.\n\n"
                "Available Commands:\n"
                "/help - Show available commands"
            )
            
            update.message.reply_text(
                welcome_message,
                parse_mode=ParseMode.MARKDOWN
            )
            logger.info(f"Welcome message sent to chat_id {chat_id}")
            
            # Dann speichere die chat_id
            if os.path.exists(self.notifications_file):
                with open(self.notifications_file, 'r') as f:
                    settings = json.load(f)
                    
                if 'telegram' not in settings:
                    settings['telegram'] = {}
                if 'chat_ids' not in settings['telegram']:
                    settings['telegram']['chat_ids'] = []
                if chat_id not in settings['telegram']['chat_ids']:
                    settings['telegram']['chat_ids'].append(chat_id)
                    
                with open(self.notifications_file, 'w') as f:
                    json.dump(settings, f, indent=2)
                    
        except Exception as e:
            logger.error(f"Error in start command: {e}", exc_info=True)

    def load_config(self):
        """Loads the configuration"""
        if self.config_file.exists():
            with open(self.config_file) as f:
                self.config = json.load(f)
        else:
            self.config = {
                'chat_id': None,
                'notifications_enabled': False  # New field for status
            }

    def save_config(self):
        """Saves the configuration"""
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
        """Sends welcome message when bot starts"""
        welcome_msg = """🖨 BambuCam Telegram Bot

Bot setup successful!
You will now receive notifications about your prints.

Available Commands:
/help - Show available commands"""
        
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
        """Sends a notification when status changes"""
        try:
            if not os.path.exists(self.notifications_file):
                return
            
            with open(self.notifications_file, 'r') as f:
                settings = json.load(f)
            
            if 'chat_ids' not in settings.get('telegram', {}):
                return
            
            message = "🔔 Notifications enabled" if enabled else "🔕 Notifications disabled"
            
            # Direkt die Nachricht an alle chat_ids senden
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
        """Waits until the bot is set up"""
        start_time = time.time()
        while not self.is_ready and time.time() - start_time < timeout:
            time.sleep(1)
            if self.is_ready:
                return True
                
        # Timeout - return helpful error message
        bot_info = self.bot.bot.get_me() if self.bot else None
        if bot_info:
            raise TimeoutError(
                f"Setup timeout - please open https://t.me/{bot_info.username} "
                "and send /start to complete setup"
            )
        else:
            raise TimeoutError("Setup timeout - please send /start to the bot")

    def disable(self):
        """Disables notifications"""
        try:
            # First send message, then disable
            self.send_notification("🔕 Notifications disabled")
            self.config['notifications_enabled'] = False
            self.save_config()
            return True
        except Exception as e:
            logger.error(f"Error disabling notifications: {e}")
            return False

    def enable(self):
        """Enables notifications"""
        try:
            self.config['notifications_enabled'] = True
            self.save_config()
            # Message after enabling
            self.send_notification("🔔 Notifications enabled!")
            return True
        except Exception as e:
            logger.error(f"Error enabling notifications: {e}")
            return False

# Global instance
telegram_service = TelegramService() 