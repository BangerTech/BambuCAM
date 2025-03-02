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
import paho.mqtt.client as mqtt

# Warnungen für selbst-signierte Zertifikate unterdrücken
requests.packages.urllib3.disable_warnings(category=InsecureRequestWarning)

logger = logging.getLogger(__name__)

def test_lan_mode(ip):
    """Tests if printer is in LAN mode by checking RTSP port"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((ip, 322))
        sock.close()
        
        return result == 0
    except Exception as e:
        logger.error(f"Error testing LAN mode for {ip}: {e}")
        return False

def parse_printer_info(response, ip):
    """Extrahiert detaillierte Drucker-Informationen aus der SSDP-Antwort"""
    printer_info = {
        'id': str(uuid.uuid4()),
        'ip': ip,
        'type': 'BAMBULAB',
        'status': 'online',
        'mode': 'unknown',
        'serial': '',
        'name': f'Printer {ip}',
        'model': 'X1C',
        'version': '',
        'lan_mode_enabled': False,
        'access_code': ''
    }
    
    try:
        # Check LAN mode using RTSP port
        lan_mode_available = test_lan_mode(ip)
        printer_info['lan_mode_enabled'] = lan_mode_available

        # Parse SSDP response for additional info
        for line in response.split('\r\n'):
            if 'DevName.bambu.com:' in line:
                printer_info['name'] = line.split(':', 1)[1].strip()
            elif 'DevModel.bambu.com:' in line:
                printer_info['model'] = line.split(':', 1)[1].strip()
            elif 'DevVersion.bambu.com:' in line:
                printer_info['version'] = line.split(':', 1)[1].strip()
            elif 'DevConnect.bambu.com:' in line:
                connect_mode = line.split(':', 1)[1].strip().lower()
                printer_info['mode'] = connect_mode  # Use the actual mode from the header
            elif 'USN:' in line:
                printer_info['serial'] = line.split(':', 1)[1].strip()

        # If DevConnect header wasn't found, fall back to the port test
        if printer_info['mode'] == 'unknown':
            printer_info['mode'] = 'lan' if lan_mode_available else 'cloud'

        logger.debug(f"Found printer: {printer_info}")
        return printer_info
        
    except Exception as e:
        logger.error(f"Error parsing printer info for {ip}: {e}")
        return printer_info

def scanNetwork(network_range=None):
    """Scannt das Netzwerk nach Bambu Lab Druckern"""
    try:
        # Get local IP and network if not provided
        if not network_range:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                s.connect(('8.8.8.8', 80))
                local_ip = s.getsockname()[0]
                logger.info(f"Local IP: {local_ip}")
                network_range = f"{'.'.join(local_ip.split('.')[:3])}.0/24"
            except Exception as e:
                logger.error(f"Error getting local IP: {e}")
                network_range = "192.168.1.0/24"  # Fallback
            finally:
                s.close()
                
        logger.info(f"Starting network scan on {network_range}")
        found_printers = []
        
        # SSDP Discovery
        ssdp_request = (
            'M-SEARCH * HTTP/1.1\r\n'
            'HOST: 239.255.255.250:1990\r\n'
            'MAN: "ssdp:discover"\r\n'
            'MX: 3\r\n'
            'ST: urn:bambulab-com:device:3dprinter:1\r\n'
            '\r\n'
        ).encode()

        # UDP Socket für SSDP mit Broadcast
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.settimeout(2)

        try:
            # Bind to all interfaces
            sock.bind(('0.0.0.0', 0))
            logger.info(f"SSDP socket bound to port {sock.getsockname()[1]}")

            # Sende SSDP Anfragen auf verschiedenen Ports
            discovery_ports = [1990, 2021, 1982]  # Added 1982
            for port in discovery_ports:
                try:
                    logger.info(f"Sending SSDP discovery to port {port}")
                    for _ in range(3):
                        sock.sendto(ssdp_request, ('239.255.255.250', port))
                        sock.sendto(ssdp_request, ('255.255.255.255', port))
                        time.sleep(0.2)
                except Exception as e:
                    logger.error(f"Error sending to port {port}: {e}")

            # Sammle SSDP Antworten
            start_time = time.time()
            while time.time() - start_time < 5:
                try:
                    data, addr = sock.recvfrom(4096)
                    response = data.decode()
                    logger.debug(f"Received from {addr}: {response}")
                    
                    if 'bambulab' in response.lower():
                        printer_info = parse_printer_info(response, addr[0])
                        if not any(p['ip'] == addr[0] for p in found_printers):
                            found_printers.append(printer_info)
                            logger.info(f"Found printer via SSDP: {printer_info}")
                        
                except socket.timeout:
                    continue
                except Exception as e:
                    logger.error(f"Error receiving SSDP response: {e}")

        finally:
            sock.close()

        # HTTP Scan als Backup
        if not found_printers:
            logger.info("No printers found via SSDP, trying HTTP scan...")
            result_queue = queue.Queue()
            threads = []
            
            network = ipaddress.ip_network(network_range)
            logger.info(f"Scanning {len(list(network.hosts()))} hosts...")
            
            for ip in network.hosts():
                ip_str = str(ip)
                thread = threading.Thread(target=scan_printer, args=(ip_str, 8989, result_queue))
                thread.daemon = True
                threads.append(thread)
                thread.start()
            
            # Wait for all threads with timeout
            for thread in threads:
                thread.join(timeout=0.1)
            
            while not result_queue.empty():
                found_printers.append(result_queue.get())

        logger.info(f"Scan complete. Found {len(found_printers)} printers")
        return found_printers

    except Exception as e:
        logger.error(f"Error during network scan: {e}")
        return [] 