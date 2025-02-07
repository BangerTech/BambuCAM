from .telegramService import telegram_service
import logging

logger = logging.getLogger(__name__)

def send_printer_notification(printer_name, status, message=None):
    """Sendet eine Drucker-spezifische Benachrichtigung"""
    try:
        # Status-spezifische Emojis
        status_emojis = {
            'completed': '✅',
            'failed': '❌',
            'error': '⚠️',
            'started': '🚀',
            'paused': '⏸️'
        }
        
        emoji = status_emojis.get(status.lower(), '🖨️')
        
        # Basis-Nachricht
        notification = f"{emoji} *{printer_name}*: "
        
        # Status-spezifische Nachricht
        if message:
            notification += message
        else:
            notification += f"Status: {status}"
            
        # Sende über alle konfigurierten Kanäle
        if telegram_service.is_configured():
            telegram_service.send_notification(notification)
            
    except Exception as e:
        logger.error(f"Error sending printer notification: {e}") 