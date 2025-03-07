import os
from pathlib import Path
from dotenv import load_dotenv
import logging

load_dotenv()

# Logging Konfiguration
logging.basicConfig(
    level=logging.DEBUG,  # Setze Basis-Level auf DEBUG
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Spezifische Logger konfigurieren
logging.getLogger('src.services.printerService').setLevel(logging.DEBUG)
logging.getLogger('src.services.bambuCloudService').setLevel(logging.DEBUG)
logging.getLogger('src.routes.cloud').setLevel(logging.DEBUG)
logging.getLogger('src.app').setLevel(logging.INFO)
logging.getLogger('werkzeug').setLevel(logging.INFO)

# Basis-Verzeichnisse
BASE_DIR = Path(os.path.dirname(os.path.dirname(__file__)))
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
    # Base directories
    BASE_DIR = Path(os.path.dirname(os.path.dirname(__file__)))
    DATA_DIR = BASE_DIR / 'data'
    PRINTERS_DIR = DATA_DIR / 'printers'
    NOTIFICATIONS_DIR = DATA_DIR / 'notifications'
    BAMBU_CLOUD_DIR = DATA_DIR / 'bambu-cloud'
    LOGS_DIR = BASE_DIR / 'logs'
    GO2RTC_DIR = DATA_DIR / 'go2rtc'
    GO2RTC_CONFIG = GO2RTC_DIR / 'go2rtc.yaml'

    # Ensure all required directories exist
    REQUIRED_DIRS = [
        DATA_DIR,
        PRINTERS_DIR,
        NOTIFICATIONS_DIR,
        BAMBU_CLOUD_DIR,
        LOGS_DIR,
        GO2RTC_DIR
    ]
    
    @classmethod
    def init_directories(cls):
        """Initialize all required directories"""
        for directory in cls.REQUIRED_DIRS:
            os.makedirs(directory, exist_ok=True)

    # Dateipfade
    BAMBU_CLOUD_FILE = BAMBU_CLOUD_DIR / 'bambu_cloud.json'

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