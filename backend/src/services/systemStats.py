import psutil
import logging

logger = logging.getLogger(__name__)

def bytes_to_gb(bytes_value):
    """Konvertiert Bytes in GB"""
    return bytes_value / (1024 * 1024 * 1024)

def get_system_stats():
    """Sammelt System-Statistiken"""
    try:
        # CPU Info
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_cores = psutil.cpu_count()
        
        # Memory Info
        memory = psutil.virtual_memory()
        memory_total = bytes_to_gb(memory.total)
        memory_used = bytes_to_gb(memory.used)
        
        # Disk Info
        disk = psutil.disk_usage('/')
        disk_total = bytes_to_gb(disk.total)
        disk_used = bytes_to_gb(disk.used)
        
        return {
            'cpu': {
                'percent': cpu_percent,
                'cores': cpu_cores
            },
            'memory': {
                'total': memory_total,
                'used': memory_used,
                'percent': memory.percent
            },
            'disk': {
                'total': disk_total,
                'used': disk_used,
                'percent': disk.percent
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting system stats: {e}")
        return None 