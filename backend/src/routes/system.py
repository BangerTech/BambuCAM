import psutil
import os
import time
from flask import Blueprint, jsonify

system_bp = Blueprint('system', __name__)

@system_bp.route('/stats')
def get_stats():
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Temperatur (nur auf Raspberry Pi)
        try:
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                temp = float(f.read()) / 1000.0
        except:
            temp = 0

        return jsonify({
            'cpu_percent': cpu_percent,
            'memory_total': memory.total,
            'memory_used': memory.used,
            'disk_total': disk.total,
            'disk_used': disk.used,
            'temperature': temp,
            'uptime': int(time.time() - psutil.boot_time())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@system_bp.route('/shutdown', methods=['POST'])
def shutdown():
    os.system('sudo shutdown -h now')
    return jsonify({'status': 'ok'})

@system_bp.route('/reboot', methods=['POST'])
def reboot():
    os.system('sudo reboot')
    return jsonify({'status': 'ok'}) 