from flask import Blueprint, jsonify, request
from flask_cors import cross_origin
from src.services.bambuCloudService import bambu_cloud_service
from src.config import Config
import json
import os
import logging
from src.services.printerService import getPrinterById

logger = logging.getLogger(__name__)

cloud_bp = Blueprint('cloud', __name__)

@cloud_bp.route('/api/cloud/login', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True, allow_headers=['Content-Type', 'Accept', 'Cache-Control'])
def cloud_login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        verification_code = data.get('verification_code')
        
        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400
            
        # Login zur Cloud API
        result = bambu_cloud_service.login(email, password, verification_code)
        
        if result.get('success'):
            # Get user ID from preferences API
            user_id = bambu_cloud_service.get_user_id()
            
            # Speichere erfolgreiche Zugangsdaten
            cloud_config = {
                'email': email,
                'password': password,
                'token': result.get('token'),
                'user_id': user_id,
                'connected': True
            }
            
            logger.info("Saving cloud config with token and user ID")
            os.makedirs(Config.BAMBU_CLOUD_DIR, exist_ok=True)
            
            # Save config
            with open(Config.BAMBU_CLOUD_FILE, 'w') as f:
                json.dump(cloud_config, f, indent=2)
                f.flush()  # Ensure it's written to disk
                os.fsync(f.fileno())  # Force write to disk
            
            logger.info(f"Saved cloud config to {Config.BAMBU_CLOUD_FILE}")
            
            # Don't setup MQTT here, it will be set up when a printer is added
            logger.info("MQTT setup deferred until a printer is added")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error during cloud login: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@cloud_bp.route('/api/cloud/printers', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True, allow_headers=['Content-Type', 'Accept', 'Cache-Control'])
def get_cloud_printers():
    try:
        printers = bambu_cloud_service.get_cloud_printers()
        return jsonify(printers)
    except Exception as e:
        logger.error(f"Error fetching cloud printers: {e}")
        return jsonify({'error': str(e)}), 500

@cloud_bp.route('/api/cloud/status', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True, allow_headers=['Content-Type', 'Accept', 'Cache-Control'])
def get_cloud_status():
    try:
        if os.path.exists(Config.BAMBU_CLOUD_FILE):
            with open(Config.BAMBU_CLOUD_FILE, 'r') as f:
                config = json.load(f)
                return jsonify({
                    'connected': config.get('connected', False),
                    'mqtt_connected': bambu_cloud_service.mqtt_connected
                })
        return jsonify({'connected': False, 'mqtt_connected': False})
    except Exception as e:
        logger.error(f"Error getting cloud status: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@cloud_bp.route('/api/cloud/printers/add', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True, allow_headers=['Content-Type', 'Accept', 'Cache-Control'])
def add_cloud_printer():
    try:
        data = request.get_json()
        logger.info(f"Adding cloud printer with data: {data}")
        
        # Validate required fields
        if not data.get('cloudId') or not data.get('accessCode'):
            return jsonify({
                'success': False,
                'error': 'Missing required cloud printer data (cloudId or accessCode)'
            }), 400
        
        # Get initial printer state from Bambu API
        initial_state = bambu_cloud_service.get_cloud_printer_status(
            data.get('cloudId'),
            data.get('accessCode')
        ) or {'device': {}, 'print': {}}  # Provide empty structure if None
        
        logger.info(f"Initial state from Bambu API: {initial_state}")
        
        device_status = initial_state.get('device', {})
        print_status = initial_state.get('print', {})
        
        # Formatiere die Druckerdaten ins richtige Format
        printer_data = {
            'name': data.get('name'),
            'type': 'CLOUD',
            'ip': None,  # Cloud Drucker haben keine direkte IP
            'cloudId': data.get('cloudId'),
            'accessCode': data.get('accessCode'),
            'model': data.get('model'),
            'status': device_status.get('status', 'online'),  # Default to online since we can add it
            'isCloud': True,
            'temperatures': {
                'hotend': device_status.get('hotend_temp', 0),
                'bed': device_status.get('bed_temp', 0),
                'chamber': device_status.get('chamber_temp', 0)
            },
            'targets': {
                'hotend': device_status.get('target_temp', 0),
                'bed': device_status.get('bed_target_temp', 0)
            },
            'progress': print_status.get('progress', 0),
            'port': 8554,
            'nozzle_diameter': device_status.get('nozzle_diameter', 0.4),
            'print_status': 'IDLE',  # Default to IDLE for new printers
            'online': True,  # If we can add it, it's online
            'flow_rate': device_status.get('flow_rate', 100),
            'cooling_fan': device_status.get('cooling_fan', 0),
            'current_layer': print_status.get('current_layer', 0),
            'total_layers': print_status.get('total_layers', 0),
            'time_remaining': print_status.get('time_remaining', 0)
        }
        
        # Füge den Drucker hinzu
        from src.services.printerService import addPrinter
        new_printer = addPrinter(printer_data)
        
        if not new_printer:
            return jsonify({
                'success': False,
                'error': 'Failed to add printer to database'
            }), 500
        
        # Setup MQTT connection specifically for this printer
        mqtt_setup_success = bambu_cloud_service.setup_mqtt_for_printer(data.get('cloudId'))
        logger.info(f"MQTT setup for printer {data.get('cloudId')}: {'Success' if mqtt_setup_success else 'Failed'}")
        
        return jsonify({
            'success': True,
            'printer': new_printer,
            'mqtt_connected': mqtt_setup_success
        })
        
    except Exception as e:
        logger.error(f"Error adding cloud printer: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@cloud_bp.route('/api/cloud/printers/<printer_id>/status', methods=['GET'])
@cross_origin(supports_credentials=True)
def get_cloud_printer_status(printer_id):
    """Get status of a cloud printer"""
    try:
        # Get printer info from database
        printer = getPrinterById(printer_id)
        if not printer:
            raise HTTPException(status_code=404, detail="Printer not found")
            
        logger.debug(f"Fetching status for cloud printer {printer_id} (cloudId: {printer.get('cloudId')})")
        
        # First try to get data from MQTT cache
        mqtt_data = bambu_cloud_service.temperature_data.get(printer.get('cloudId'))
        printer_data = bambu_cloud_service.printer_data.get(printer.get('cloudId'))
        
        if mqtt_data:
            logger.debug(f"Using MQTT data for printer {printer_id}: {mqtt_data}")
            # Format response using MQTT data
            response = {
                'online': True,  # If we have MQTT data, the printer is online
                'print_status': printer_data.get('print', {}).get('gcode_state', 'IDLE'),
                'temperatures': mqtt_data.get('temperatures', {
                    'hotend': 0.0,
                    'bed': 0.0,
                    'chamber': 0.0
                }),
                'targets': mqtt_data.get('targets', {
                    'hotend': 0.0,
                    'bed': 0.0
                }),
                'progress': printer_data.get('print', {}).get('mc_percent', 0.0),
                'remaining_time': printer_data.get('print', {}).get('mc_remaining_time', 0),
                'current_layer': printer_data.get('print', {}).get('current_layer', 0),
                'total_layers': printer_data.get('print', {}).get('total_layers', 0)
            }
            logger.debug(f"Formatted MQTT status response: {response}")
            return response
            
        # Fallback to API if no MQTT data
        status = bambu_cloud_service.get_cloud_printer_status(printer.get('cloudId'), printer.get('accessCode'))
        logger.debug(f"Raw cloud printer status: {status}")
        
        # Extract device and print status
        device_status = status.get('device', {}) if status else {}
        print_status = status.get('print', {}) if status else {}
        
        logger.debug(f"Device status: {device_status}")
        logger.debug(f"Print status: {print_status}")
        
        # Format response
        response = {
            'online': device_status.get('status') == 'ACTIVE',
            'print_status': print_status.get('gcode_state', 'IDLE'),
            'temperatures': {
                'hotend': device_status.get('hotend_temp', 0.0),
                'bed': device_status.get('bed_temp', 0.0),
                'chamber': device_status.get('chamber_temp', 0.0)
            },
            'targets': {
                'hotend': device_status.get('target_nozzle_temp', 0.0),
                'bed': device_status.get('target_bed_temp', 0.0)
            },
            'progress': print_status.get('mc_percent', 0.0),
            'remaining_time': print_status.get('mc_remaining_time', 0),
            'current_layer': print_status.get('current_layer', 0),
            'total_layers': print_status.get('total_layers', 0)
        }
        
        logger.debug(f"Formatted API status response: {response}")
        return response
        
    except Exception as e:
        logger.error(f"Error getting cloud printer status: {e}", exc_info=True)
        if not status:
            logger.warning(f"No status received for printer {printer_id}")
        return {
            'online': False,
            'print_status': 'IDLE',
            'temperatures': {'hotend': 0.0, 'bed': 0.0, 'chamber': 0.0},
            'targets': {'hotend': 0.0, 'bed': 0.0},
            'progress': 0.0,
            'remaining_time': 0,
            'current_layer': 0,
            'total_layers': 0
        }

@cloud_bp.route('/api/cloud/printers/<printer_id>/stream', methods=['GET'])
@cross_origin(supports_credentials=True)
def get_cloud_printer_stream(printer_id):
    try:
        # Get printer from database
        printer = getPrinterById(printer_id)
        
        if not printer:
            return jsonify({'error': 'Printer not found'}), 404
            
        # Get stream info from cloud service
        stream_info = bambu_cloud_service.get_stream_url(
            printer.get('cloudId', printer_id),  # Use cloudId if available, fallback to id
            printer.get('accessCode')
        )
        
        if not stream_info:
            return jsonify({'error': 'Could not get printer stream URL'}), 500
            
        logger.info(f"Got stream info for printer {printer_id}: {stream_info}")
        
        # Return stream info including type and URL
        return jsonify({
            'url': stream_info.get('url'),
            'type': stream_info.get('type', 'unknown'),
            'token': stream_info.get('token'),  # Only present for cloud streams
            'expires': stream_info.get('expires')  # Only present for cloud streams
        })
            
    except Exception as e:
        logger.error(f"Error getting cloud printer stream: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@cloud_bp.route('/api/cloud/printer/<printer_id>', methods=['DELETE', 'OPTIONS'])
@cross_origin(supports_credentials=True, allow_headers=['Content-Type', 'Accept', 'Cache-Control'])
def delete_cloud_printer(printer_id):
    """Löscht einen Cloud-Drucker"""
    try:
        printer = getPrinterById(printer_id)
        if not printer:
            logger.warning(f"Printer {printer_id} not found")
            return jsonify({"error": "Printer not found"}), 404
            
        # Lösche den Drucker
        from src.services.printerService import removePrinter
        success = removePrinter(printer_id)
        
        if success:
            logger.info(f"Successfully deleted cloud printer {printer_id}")
            return jsonify({'success': True})
            
        logger.error(f"Failed to delete printer {printer_id}")
        return jsonify({'error': 'Could not delete printer'}), 500
            
    except Exception as e:
        logger.error(f"Error deleting cloud printer: {e}")
        return jsonify({'error': str(e)}), 500 