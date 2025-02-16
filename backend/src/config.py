import os
from pathlib import Path
from dotenv import load_dotenv
import logging

load_dotenv()

# Basis-Verzeichnisse
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'data'
LOGS_DIR = BASE_DIR / 'logs'

# Setze Standard-Log-Level auf INFO und reduziere urllib3 Logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Reduziere urllib3 Logging
logging.getLogger('urllib3').setLevel(logging.WARNING)

# Reduziere weitere Debug-Logs
logging.getLogger('urllib3.connectionpool').setLevel(logging.WARNING)
logging.getLogger('werkzeug').setLevel(logging.WARNING)

class Config:
    # Verzeichnis-Konfiguration
    DATA_DIR = DATA_DIR
    PRINTERS_DATA_DIR = DATA_DIR / 'printers'
    STREAMS_DATA_DIR = DATA_DIR / 'streams'
    NOTIFICATIONS_DATA_DIR = DATA_DIR / 'notifications'
    LOGS_DIR = LOGS_DIR

    # Stelle sicher, dass die Verzeichnisse existieren
    DATA_DIR.mkdir(exist_ok=True)
    PRINTERS_DATA_DIR.mkdir(exist_ok=True)
    STREAMS_DATA_DIR.mkdir(exist_ok=True)
    NOTIFICATIONS_DATA_DIR.mkdir(exist_ok=True)
    LOGS_DIR.mkdir(exist_ok=True)

    # Flask Konfiguration
    DEBUG = os.getenv('FLASK_DEBUG', 'False') == 'True'
    HOST = os.getenv('FLASK_HOST', '0.0.0.0')
    PORT = int(os.getenv('FLASK_PORT', 4000))

    # API Konfiguration
    API_PREFIX = '/api'
    
    # Telegram Konfiguration
    TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
    TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

    # Cloud Konfiguration
    CLOUD_API_URL = os.getenv('CLOUD_API_URL')
    CLOUD_API_KEY = os.getenv('CLOUD_API_KEY')

config = Config() 