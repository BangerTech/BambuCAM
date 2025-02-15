from flask import Flask
from flask_cors import CORS
import logging

# Standard Logger Setup
logger = logging.getLogger(__name__)

def create_app():
    app = Flask(__name__)
    logger.info("Starting Flask application...")
    
    # CORS konfigurieren
    CORS(app)
    
    from src.routes import register_blueprints
    register_blueprints(app)
    
    return app 