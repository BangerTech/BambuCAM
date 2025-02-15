from flask import Flask
from flask_cors import CORS
from src.config import config
from src.routes import register_blueprints
from src.utils.logger import logger

def create_app():
    app = Flask(__name__)
    logger.info("Starting Flask application...")
    
    # CORS konfigurieren
    CORS(app)
    
    # Blueprints registrieren
    register_blueprints(app)
    
    return app 