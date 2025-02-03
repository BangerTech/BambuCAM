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
                # Korrekte RTSP Stream URL für Bambulab
                'streamUrl': f"rtsps://bblp:{access_code}@{ip}:322/streaming/live/1",
                'accessCode': access_code,
                # Korrekte HTTP API URL
                'apiUrl': f"http://{ip}:80/api/v1",
                'wsPort': printer_data.get('wsPort', 9000)
            }

        elif printer_type == 'CREALITY_K1':
            printer = {
                'name': printer_data.get('name', f'K1 ({ip})'),
                'ip': ip,
                'type': 'CREALITY_K1',
                'streamUrl': f"http://{ip}:4408/webcam/?action=stream",
                'apiUrl': f"http://{ip}:7125/printer/objects/query",
                'wsPort': printer_data.get('wsPort', 9000)
            }

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