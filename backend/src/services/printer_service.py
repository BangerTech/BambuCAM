def addPrinter(printer_data):
    """Fügt einen neuen Drucker hinzu"""
    try:
        printer_type = printer_data.get('type', '').upper()
        ip = printer_data.get('ip', '')
        
        if not ip:
            return False, "IP address is required"

        if printer_type == 'BAMBULAB':
            access_code = printer_data.get('accessCode')
            if not access_code:
                return False, "Access code is required for Bambulab printers"
                
            printer = {
                'name': printer_data.get('name', f'Bambulab ({ip})'),
                'ip': ip,
                'type': 'BAMBULAB',
                # Korrekte Stream-URL für Bambulab X1C
                'streamUrl': f"rtsp://bblp:{access_code}@{ip}:8554/live",
                'accessCode': access_code,
                'apiUrl': f"http://{ip}:8888/api",  # Bambulab API Port
                'mqttPort': 8883,
                'mqttUser': 'bblp',
                'mqttPassword': access_code
            }

        elif printer_type == 'CREALITY_K1':
            # ... existierender K1 Code ...

        # Generiere eindeutige ID
        printer_id = str(uuid.uuid4())
        printer['id'] = printer_id
        printer['added'] = datetime.now().isoformat()

        # Speichere Drucker
        stored_printers[printer_id] = printer
        savePrinters()
        
        return True, printer_id

    except Exception as e:
        logger.error(f"Error adding printer: {e}")
        return False, str(e) 