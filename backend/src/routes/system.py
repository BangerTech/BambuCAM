import psutil
import os
import time
import platform
from flask import Blueprint, jsonify
from flask_cors import cross_origin
import logging

logger = logging.getLogger(__name__)
system_bp = Blueprint('system', __name__)

# Cache für System-Informationen
system_info_cache = {
    'last_update': 0,
    'data': None
}
CACHE_DURATION = 2  # Cache für 2 Sekunden

def get_cpu_temp():
    """Liest CPU Temperatur systemspezifisch"""
    try:
        if platform.system() == "Linux":
            # Raspberry Pi
            if os.path.exists('/sys/class/thermal/thermal_zone0/temp'):
                with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                    return float(f.read()) / 1000.0
            # Andere Linux Systeme
            if os.path.exists('/sys/class/hwmon'):
                for hwmon in os.listdir('/sys/class/hwmon'):
                    name_path = f'/sys/class/hwmon/{hwmon}/name'
                    if os.path.exists(name_path):
                        with open(name_path, 'r') as f:
                            if 'coretemp' in f.read():
                                temp_path = f'/sys/class/hwmon/{hwmon}/temp1_input'
                                if os.path.exists(temp_path):
                                    with open(temp_path, 'r') as f:
                                        return float(f.read()) / 1000.0
    except Exception as e:
        logger.debug(f"Could not read CPU temperature: {e}")
    return 0

def get_memory_info():
    """Holt Speicherinformationen"""
    mem = psutil.virtual_memory()
    return {
        'total': mem.total,
        'used': mem.used,
        'percent': mem.percent,
        'available': mem.available
    }

def get_disk_info():
    """Holt Festplatteninformationen"""
    disk = psutil.disk_usage('/')
    return {
        'total': disk.total,
        'used': disk.used,
        'percent': disk.percent,
        'free': disk.free
    }

def get_load_average():
    """Holt Load Average (nur Linux/Unix)"""
    try:
        if platform.system() != "Windows":
            load1, load5, load15 = psutil.getloadavg()
            cpu_count = psutil.cpu_count()
            return [
                (load1 / cpu_count) * 100,
                (load5 / cpu_count) * 100,
                (load15 / cpu_count) * 100
            ]
    except:
        pass
    return [0, 0, 0]

@system_bp.route('/system/stats')
@cross_origin()
def get_stats():
    """Liefert System-Statistiken"""
    try:
        current_time = time.time()
        
        # Prüfe Cache
        if system_info_cache['data'] and current_time - system_info_cache['last_update'] < CACHE_DURATION:
            return jsonify(system_info_cache['data'])

        # CPU Nutzung (1 Sekunde Intervall)
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # Sammle Systeminformationen
        stats = {
            'hostname': platform.node(),
            'platform': platform.system(),
            'architecture': platform.machine(),
            'processor': platform.processor(),
            'cpu_cores': psutil.cpu_count(),
            'cpu_percent': cpu_percent,
            'memory': get_memory_info(),
            'disk': get_disk_info(),
            'temperature': get_cpu_temp(),
            'load_average': get_load_average(),
            'uptime': int(time.time() - psutil.boot_time()),
            'timestamp': int(time.time())
        }

        # Aktualisiere Cache
        system_info_cache['data'] = stats
        system_info_cache['last_update'] = current_time

        return jsonify(stats)

    except Exception as e:
        logger.error(f"Error getting system stats: {e}")
        return jsonify({'error': str(e)}), 500

@system_bp.route('/system/shutdown', methods=['POST'])
@cross_origin()
def shutdown():
    """System herunterfahren (nur Linux)"""
    if platform.system() == "Linux":
        try:
            os.system('sudo shutdown -h now')
            return jsonify({'status': 'ok'})
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")
            return jsonify({'error': str(e)}), 500
    return jsonify({'error': 'Shutdown only supported on Linux'}), 400

@system_bp.route('/system/reboot', methods=['POST'])
@cross_origin()
def reboot():
    """System neustarten (nur Linux)"""
    if platform.system() == "Linux":
        try:
            os.system('sudo reboot')
            return jsonify({'status': 'ok'})
        except Exception as e:
            logger.error(f"Error during reboot: {e}")
            return jsonify({'error': str(e)}), 500
    return jsonify({'error': 'Reboot only supported on Linux'}), 400 