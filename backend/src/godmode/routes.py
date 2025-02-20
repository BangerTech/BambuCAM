from flask import Blueprint, jsonify, request
from .godmode_scanner import scanner as godmode_scanner
from .auth import require_cloud_token
from .types import Printer

godmode_bp = Blueprint('godmode', __name__, url_prefix='/api/godmode')

@godmode_bp.route('/scan', methods=['GET'])
@require_cloud_token
async def scan_all_printers():
    """
    Scannt gleichzeitig nach LAN und Cloud Druckern.
    Erfordert Cloud-Token für die Cloud-Drucker.
    """
    try:
        token = request.headers.get('Authorization').split(' ')[1]
        results = await godmode_scanner.scan_network()
        return jsonify(results)
    except Exception as e:
        return jsonify({
            'error': f"God Mode scan failed: {str(e)}"
        }), 500 