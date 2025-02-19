# Leere Datei zur Markierung als Python-Paket 

from .printers import printers_bp
from .system import system_bp
from .notifications import notifications_bp
from .stream import stream_bp
from .cloud import cloud_bp

def register_blueprints(app):
    """Registriert alle Blueprints"""
    from .cloud import cloud_bp
    #from .system import system_bp
    from src.routes.system import system_bp    
    from .notifications import notifications_bp
    from .stream import stream_bp
    from .printers import printers_bp

    app.register_blueprint(cloud_bp, url_prefix='')
    #app.register_blueprint(system_bp)
    app.register_blueprint(system_bp, url_prefix='/api/system')    
    app.register_blueprint(notifications_bp)
    app.register_blueprint(stream_bp)
    app.register_blueprint(printers_bp) 
    