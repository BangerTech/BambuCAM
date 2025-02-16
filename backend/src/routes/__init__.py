# Leere Datei zur Markierung als Python-Paket 

from .printers import printers_bp
from .system import system_bp
from .notifications import notifications_bp
from .stream import stream_bp
from .cloud import cloud_bp

def register_blueprints(app):
    """Registriert alle Blueprints"""
    from src.routes.printers import printers_bp
    from src.routes.stream import stream_bp
    from src.routes.notifications import notifications_bp
    from src.routes.cloud import cloud_bp
    from src.routes.system import system_bp

    app.register_blueprint(printers_bp, url_prefix='/api')
    app.register_blueprint(stream_bp, url_prefix='/api/stream')  # Wichtig: /api/stream statt /stream
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
    app.register_blueprint(cloud_bp, url_prefix='/api/cloud')
    app.register_blueprint(system_bp, url_prefix='/api/system') 