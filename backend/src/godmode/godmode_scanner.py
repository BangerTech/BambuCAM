import socket
import struct
import logging
from typing import List, Dict, Any
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import requests

@dataclass
class DiscoveredPrinter:
    name: str
    ip: str
    type: str
    id: str = None
    model: str = None
    access_code: str = None

class GodModeScanner:
    def __init__(self):
        self.logger = logging.getLogger("GodModeScanner")
        self.executor = ThreadPoolExecutor(max_workers=10)

    def scan_network(self) -> List[DiscoveredPrinter]:
        """Scannt das Netzwerk nach allen unterstützten Druckertypen"""
        self.logger.info("Starting God Mode network scan...")
        
        # Führe alle Scans parallel aus
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(
                lambda f: f(),
                [self.scan_bambulab_printers, self.scan_creality_printers]
            ))
        
        # Kombiniere alle Ergebnisse
        all_printers = []
        for result in results:
            if isinstance(result, Exception):
                self.logger.error(f"Scan error: {result}")
                continue
            all_printers.extend(result)
        
        return all_printers

    def scan_bambulab_printers(self) -> List[DiscoveredPrinter]:
        """Scannt nach Bambu Lab Druckern via LAN"""
        printers = []
        try:
            # Sende Multicast-Discovery-Paket
            MULTICAST_PORT = 2021
            MULTICAST_GROUP = "239.255.255.250"
            
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(1)
            
            message = b"Discovery"
            sock.sendto(message, (MULTICAST_GROUP, MULTICAST_PORT))
            
            while True:
                try:
                    data, addr = sock.recvfrom(1024)
                    if data:
                        # Parse Bambu Lab Response
                        printer = DiscoveredPrinter(
                            name=f"Bambu Lab Printer ({addr[0]})",
                            ip=addr[0],
                            type="BAMBULAB"
                        )
                        printers.append(printer)
                except socket.timeout:
                    break
                
        except Exception as e:
            self.logger.error(f"Error scanning for Bambu Lab printers: {e}")
        
        return printers

    def scan_creality_printers(self) -> List[DiscoveredPrinter]:
        """Scannt nach Creality Druckern im Netzwerk"""
        printers = []
        try:
            # Scanne typische Creality Ports
            CREALITY_PORTS = [8080, 8081]
            
            # Hole lokale IP-Basis
            local_ip = socket.gethostbyname(socket.gethostname())
            ip_base = '.'.join(local_ip.split('.')[:-1])
            
            for i in range(1, 255):
                ip = f"{ip_base}.{i}"
                for port in CREALITY_PORTS:
                    try:
                        url = f"http://{ip}:{port}"
                        response = requests.get(url, timeout=0.5)
                        if response.status_code == 200:
                            printer = DiscoveredPrinter(
                                name=f"Creality Printer ({ip})",
                                ip=ip,
                                type="CREALITY"
                            )
                            printers.append(printer)
                            break
                    except:
                        continue
                            
        except Exception as e:
            self.logger.error(f"Error scanning for Creality printers: {e}")
            
        return printers

# Singleton-Instanz
scanner = GodModeScanner() 