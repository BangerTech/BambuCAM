from flask import Blueprint, jsonify, request
from .scanner import god_mode_scan
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
        results = await god_mode_scan(token)
        return jsonify(results)
    except Exception as e:
        return jsonify({
            'error': f"God Mode scan failed: {str(e)}"
        }), 500 