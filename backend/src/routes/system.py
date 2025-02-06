import psutil
import os
import time
import platform
from flask import Blueprint, jsonify
from flask_cors import cross_origin

system_bp = Blueprint('system', __name__)

@system_bp.route('/system/stats')
@cross_origin()
def get_stats():
    try:
        # CPU
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # Memory
        memory = psutil.virtual_memory()
        
        # Disk
        disk = psutil.disk_usage('/')
        
        # Temperatur (nur auf Raspberry Pi)
        temp = 0
        if platform.machine().startswith('arm'):  # Raspberry Pi
            try:
                with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                    temp = float(f.read()) / 1000.0
            except:
                pass
        
        # Load average (nur auf Linux)
        load_avg = [0, 0, 0]
        if platform.system() == "Linux":
            load_avg = [x / psutil.cpu_count() * 100 for x in psutil.getloadavg()]

        return jsonify({
            'cpu_percent': cpu_percent,
            'memory_total': memory.total,
            'memory_used': memory.used,
            'memory_percent': memory.percent,
            'disk_total': disk.total,
            'disk_used': disk.used,
            'disk_percent': disk.percent,
            'temperature': temp,
            'load_average': load_avg,
            'platform': platform.system(),
            'machine': platform.machine(),
            'uptime': int(time.time() - psutil.boot_time())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@system_bp.route('/system/shutdown', methods=['POST'])
@cross_origin()
def shutdown():
    if platform.system() == "Linux":
        os.system('sudo shutdown -h now')
    return jsonify({'status': 'ok'})

@system_bp.route('/system/reboot', methods=['POST'])
@cross_origin()
def reboot():
    if platform.system() == "Linux":
        os.system('sudo reboot')
    return jsonify({'status': 'ok'}) 