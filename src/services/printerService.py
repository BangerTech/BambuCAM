import socket
import time

class PrinterService:
    def scan_network(self):
        """Scan network for Bambu Lab printers using SSDP"""
        self.logger.info("Starting network scan for printers...")
        
        # Liste für gefundene Drucker
        found_printers = {}
        
        try:
            # Beide Ports scannen
            for port in [1990, 2021]:
                self.logger.info(f"Sending SSDP discovery to port {port}")
                
                # Socket mit Timeout erstellen
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.settimeout(3)  # 3 Sekunden Timeout
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
                
                # SSDP Discovery Message
                message = (
                    'M-SEARCH * HTTP/1.1\r\n'
                    'HOST: 239.255.255.250:{}\r\n'
                    'MAN: "ssdp:discover"\r\n'
                    'ST: urn:bambulab-com:device:3dprinter:1\r\n'
                    'MX: 2\r\n'
                    '\r\n'.format(port)
                ).encode('utf-8')
                
                try:
                    # Broadcast senden
                    sock.sendto(message, ('239.255.255.250', port))
                    
                    # Mehrere Antworten empfangen
                    start_time = time.time()
                    while time.time() - start_time < 2:  # 2 Sekunden auf Antworten warten
                        try:
                            data, addr = sock.recvfrom(4096)
                            response = data.decode('utf-8')
                            self.logger.info(f"Received from {addr}: {response}")
                            
                            # Drucker-Informationen extrahieren
                            printer_info = self._parse_ssdp_response(response, addr[0])
                            if printer_info:
                                # Drucker anhand der USN (Unique Serial Number) identifizieren
                                usn = printer_info.get('usn')
                                if usn and usn not in found_printers:
                                    found_printers[usn] = printer_info
                                    self.logger.info(f"Found printer: {printer_info}")
                        
                        except socket.timeout:
                            break
                        
                except Exception as e:
                    self.logger.error(f"Error during SSDP scan on port {port}: {str(e)}")
                
                finally:
                    sock.close()
            
            # Gefundene Drucker aktualisieren
            self._update_printer_list(list(found_printers.values()))
            
            self.logger.info(f"Scan complete. Found {len(found_printers)} printers")
            return list(found_printers.values())
            
        except Exception as e:
            self.logger.error(f"Error during network scan: {str(e)}")
            return []

    def _update_printer_list(self, found_printers):
        """Update the internal printer list with found printers"""
        with self.printers_lock:
            # Bestehende Drucker als offline markieren
            for printer in self.printers.values():
                printer['status'] = 'offline'
            
            # Gefundene Drucker aktualisieren oder hinzufügen
            for printer in found_printers:
                if printer['id'] in self.printers:
                    self.printers[printer['id']].update(printer)
                else:
                    self.printers[printer['id']] = printer 