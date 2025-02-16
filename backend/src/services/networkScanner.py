import socket
import threading
import queue
import json
import requests
import logging
import uuid
from urllib3.exceptions import InsecureRequestWarning

# Warnungen für selbst-signierte Zertifikate unterdrücken
requests.packages.urllib3.disable_warnings(category=InsecureRequestWarning)

logger = logging.getLogger(__name__)

def scan_printer(ip, port, result_queue):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)  # 1 Sekunde Timeout
        
        if sock.connect_ex((ip, port)) == 0:
            try:
                response = requests.get(
                    f"http://{ip}:8989/api/info",
                    timeout=2,
                    verify=False
                )
                
                if response.status_code == 200:
                    printer_info = response.json()
                    result_queue.put({
                        'id': str(uuid.uuid4()),
                        'ip': ip,
                        'name': printer_info.get('name', f'Drucker {ip}'),
                        'model': printer_info.get('model', 'X1C'),
                        'type': 'BAMBULAB',
                        'status': printer_info.get('status', 'unknown'),
                        'accessCode': '',
                        'streamUrl': ''
                    })
            except:
                result_queue.put({
                    'id': str(uuid.uuid4()),
                    'ip': ip,
                    'name': f'Drucker {ip}',
                    'model': 'X1C',
                    'type': 'BAMBULAB',
                    'status': 'unknown',
                    'accessCode': '',
                    'streamUrl': ''
                })
    except:
        pass
    finally:
        sock.close()

def scanNetwork():
    """Scannt das lokale Netzwerk nach BambuLab Druckern"""
    logger.info("Starte Netzwerk-Scan...")
    
    try:
        # Hole lokale IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        
        # Netzwerk-Basis ermitteln
        ip_parts = local_ip.split('.')
        network_base = '.'.join(ip_parts[:-1]) + '.'
        
        # Queue für die Ergebnisse
        result_queue = queue.Queue()
        threads = []
        
        # Scanne alle IPs im lokalen Netzwerk
        for i in range(1, 255):
            ip = network_base + str(i)
            thread = threading.Thread(target=scan_printer, args=(ip, 8989, result_queue))
            thread.daemon = True
            threads.append(thread)
            thread.start()
        
        # Warte auf alle Threads
        for thread in threads:
            thread.join(timeout=0.1)
        
        # Sammle Ergebnisse
        found_printers = []
        while not result_queue.empty():
            found_printers.append(result_queue.get())
        
        logger.info(f"Scan abgeschlossen. {len(found_printers)} Drucker gefunden")
        return {'printers': found_printers}
        
    except Exception as e:
        logger.error(f"Error during network scan: {str(e)}")
        return {'printers': []} 