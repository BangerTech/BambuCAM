import socket
import threading
import queue
import json
import requests
import logging
import uuid
import time
from urllib3.exceptions import InsecureRequestWarning
import ipaddress

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
    """Scannt nach neuen Druckern im Netzwerk via SSDP"""
    try:
        logger.info("Starting network scan for printers...")
        
        # SSDP M-SEARCH Message für Bambu Lab Drucker
        ssdp_request = (
            'M-SEARCH * HTTP/1.1\r\n'
            'HOST: 239.255.255.250:1990\r\n'
            'MAN: "ssdp:discover"\r\n'
            'MX: 3\r\n'
            'ST: urn:bambulab-com:device:3dprinter:1\r\n'
            '\r\n'
        ).encode()

        # Erstelle UDP Socket mit Broadcast
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.settimeout(5)  # 5 Sekunden Timeout

        # Bind to all interfaces
        sock.bind(('', 0))

        # Sende an beide Discovery Ports
        discovery_ports = [1990, 2021]
        for port in discovery_ports:
            try:
                logger.info(f"Sending SSDP discovery to port {port}")
                # Sende beide Nachrichten mehrmals für bessere Zuverlässigkeit
                for _ in range(2):
                    sock.sendto(ssdp_request, ('239.255.255.250', port))  # Multicast
                    sock.sendto(ssdp_request, ('255.255.255.255', port))  # Broadcast
                    time.sleep(0.1)  # Kleine Pause zwischen den Versuchen
            except Exception as e:
                logger.error(f"Error sending to port {port}: {e}")

        # Sammle Antworten
        printers = []
        start_time = time.time()
        
        while time.time() - start_time < 5:  # 5 Sekunden warten
            try:
                data, addr = sock.recvfrom(4096)
                response = data.decode()
                logger.debug(f"Received from {addr}: {response}")
                
                # Parse SSDP Response
                if 'bambulab' in response.lower():
                    printer_info = {
                        'id': str(uuid.uuid4()),
                        'ip': addr[0],
                        'type': 'BAMBULAB',
                        'status': 'online'
                    }
                    
                    # Extrahiere Details aus Response
                    for line in response.split('\r\n'):
                        if 'DevName.bambu.com:' in line:
                            printer_info['name'] = line.split(':', 1)[1].strip()
                        elif 'DevModel.bambu.com:' in line:
                            printer_info['model'] = line.split(':', 1)[1].strip()
                        elif 'DevVersion.bambu.com:' in line:
                            printer_info['version'] = line.split(':', 1)[1].strip()
                    
                    # Prüfe ob der Drucker bereits gefunden wurde
                    if not any(p['ip'] == addr[0] for p in printers):
                        printers.append(printer_info)
                        logger.info(f"Found printer: {printer_info}")
                        
            except socket.timeout:
                continue
            except Exception as e:
                logger.error(f"Error receiving response: {e}")

        logger.info(f"Scan complete. Found {len(printers)} printers")
        return printers

    except Exception as e:
        logger.error(f"Error during network scan: {str(e)}")
        return []
    finally:
        try:
            sock.close()
        except:
            pass

def scanNetwork(network_range='192.168.188.0/24'):
    """Scannt das Netzwerk nach Bambu Lab Druckern"""
    try:
        logger.info(f"Starting network scan on {network_range}")
        found_printers = []
        
        # Erstelle IP-Liste aus dem Netzwerkbereich
        network = ipaddress.ip_network(network_range)
        
        # Erstelle Socket für SSDP Discovery
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(2)
        
        # SSDP Discovery Message
        ssdp_request = (
            'M-SEARCH * HTTP/1.1\r\n'
            'HOST: 239.255.255.250:1982\r\n'
            'MAN: "ssdp:discover"\r\n'
            'MX: 1\r\n'
            'ST: urn:bambulab-com:device:3dprinter:1\r\n'
            '\r\n'
        ).encode()

        # Sende SSDP Request an alle IPs im Netzwerk
        for ip in network.hosts():
            try:
                sock.sendto(ssdp_request, (str(ip), 1982))
                try:
                    while True:
                        data, addr = sock.recvfrom(1024)
                        response = data.decode()
                        
                        if 'bambu' in response.lower():
                            printer_info = parse_ssdp_response(response, addr[0])
                            if printer_info and printer_info not in found_printers:
                                found_printers.append(printer_info)
                                
                except socket.timeout:
                    continue
                    
            except Exception as e:
                logger.debug(f"Error scanning {ip}: {e}")
                continue

        logger.info(f"Network scan complete. Found {len(found_printers)} printers")
        return found_printers

    except Exception as e:
        logger.error(f"Error during network scan: {e}")
        return [] 