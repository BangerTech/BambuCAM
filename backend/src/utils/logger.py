import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Logs-Verzeichnis erstellen
LOGS_DIR = Path(__file__).parent.parent.parent / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

# Logger konfigurieren
logger = logging.getLogger('bambucam')
logger.setLevel(logging.INFO)

# Formatierung
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# File Handler (mit Rotation)
file_handler = RotatingFileHandler(
    LOGS_DIR / 'bambucam.log',
    maxBytes=1024 * 1024,  # 1MB
    backupCount=5
)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Console Handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
logger.addHandler(console_handler) 