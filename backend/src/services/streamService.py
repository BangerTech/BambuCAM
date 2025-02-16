import asyncio
import websockets
import json
import cv2
import numpy as np
import base64
from datetime import datetime
import random
import subprocess
import threading
from queue import Queue
import os
from .printerService import stored_printers, getPrinters, getPrinterById as get_printer
import logging
from pathlib import Path
from threading import Thread
import time
from flask import jsonify
from flask import current_app as app
from src.printer_types import PRINTER_CONFIGS
import signal

logger = logging.getLogger(__name__)

class StreamService:
    def __init__(self):
        self.streams_dir = 'data/streams'
        os.makedirs(self.streams_dir, exist_ok=True)
        self.active_streams = {}
        self.ws_servers = {}
        self.BASE_PORT = 9000
        self.monitor_thread = Thread(target=self.monitor_streams, daemon=True)
        self.monitor_thread.start()

    def start_stream(self, printer_id: str, stream_url: str) -> dict:
        """Startet einen neuen Stream"""
        try:
            logger.info(f"Starting stream for printer {printer_id} with URL {stream_url}")
            
            if printer_id in self.active_streams:
                logger.info(f"Stream already exists for printer {printer_id}")
                return {
                    'success': True,
                    'port': self.active_streams[printer_id]['port']
                }
            
            # Hole Drucker-Konfiguration
            printer = get_printer(printer_id)
            if not printer:
                raise Exception("Printer not found")
            
            # Starte FFmpeg Prozess
            command = [
                'ffmpeg',
                '-rtsp_transport', 'tcp',
                '-i', stream_url,
                '-c:v', 'copy',
                '-f', 'mpegts',
                f'http://127.0.0.1:{printer["port"]}'
            ]
            
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Speichere Stream-Informationen
            self.active_streams[printer_id] = {
                'process': process,
                'port': printer['port'],
                'url': stream_url
            }
            
            return {
                'success': True,
                'port': printer['port']
            }
            
        except Exception as e:
            logger.error(f"Error starting stream: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def stop_stream(self, printer_id: str) -> bool:
        """Stoppt einen aktiven Stream"""
        stream_file = os.path.join(self.streams_dir, f"{printer_id}.json")
        
        try:
            # Lade Stream-Daten
            with open(stream_file, 'r') as f:
                stream_data = json.load(f)

            # Beende den Stream-Prozess
            if stream_data.get('process_id'):
                try:
                    os.kill(stream_data['process_id'], signal.SIGTERM)
                except ProcessLookupError:
                    pass  # Prozess existiert nicht mehr

            # Lösche Stream-Datei
            os.remove(stream_file)
            return True

        except FileNotFoundError:
            return False  # Stream existiert nicht
        except Exception as e:
            logger.error(f"Error stopping stream: {e}")
            return False

    def get_stream_status(self, printer_id: str) -> dict:
        """Gibt den Status eines Streams zurück"""
        stream_file = os.path.join(self.streams_dir, f"{printer_id}.json")
        
        try:
            with open(stream_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {
                'status': 'inactive',
                'printer_id': printer_id
            }

    def _get_next_ws_port(self) -> int:
        """Findet den nächsten freien WebSocket Port"""
        used_ports = []
        for file in os.listdir(self.streams_dir):
            if file.endswith('.json'):
                try:
                    with open(os.path.join(self.streams_dir, file), 'r') as f:
                        data = json.load(f)
                        used_ports.append(data.get('websocket_port', 0))
                except:
                    continue
        
        if not used_ports:
            return 9000  # Startport für WebSocket
        return max(used_ports) + 1

    def start_websocket_server(self, port):
        """Startet einen WebSocket Server"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            start_server = websockets.serve(
                self.handle_stream,
                "0.0.0.0",
                port,
                ping_interval=None
            )
            
            loop.run_until_complete(start_server)
            
            def run_loop():
                loop.run_forever()
            
            server_thread = Thread(target=run_loop, daemon=True)
            server_thread.start()
            
            self.ws_servers[port] = {
                'loop': loop,
                'thread': server_thread
            }
            
            logger.info(f"Started WebSocket server on port {port}")
            
        except Exception as e:
            logger.error(f"Error starting WebSocket server: {e}")
            raise e

    async def handle_stream(self, websocket, path):
        try:
            logger.info("Client connected")
            last_ping = time.time()
            
            while True:
                # Sende regelmäßige Pings
                if time.time() - last_ping > 10:  # Alle 10 Sekunden
                    await websocket.ping()
                    last_ping = time.time()
                
                # Timeout Handling
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=15)
                    # Verarbeite Nachrichten
                except asyncio.TimeoutError:
                    logger.warning("Client timeout, closing connection")
                    break
                
        except websockets.ConnectionClosed:
            logger.info("Client disconnected normally")
        finally:
            await websocket.close()

    def restart_stream(self, printer_id):
        """Vereinfachter automatischer Restart"""
        if printer_id in self.active_streams:
            stream_url = self.active_streams[printer_id]['url']
            port = self.active_streams[printer_id]['port']
            self.stop_stream(printer_id)
            return self.start_stream(printer_id, stream_url)
        return False

    def monitor_streams(self):
        """Überwacht und restartet abgestürzte Streams"""
        while True:
            for printer_id in list(self.active_streams.keys()):
                stream = self.active_streams[printer_id]
                if stream['process'] is not None and stream['process'].poll() is not None:
                    logger.warning(f"Stream {printer_id} crashed, restarting...")
                    self.restart_stream(printer_id)
            time.sleep(10)  # Check alle 10 Sekunden

    def check_stream_health(self, printer_id):
        """Prüft ob der Stream noch aktiv ist"""
        if printer_id not in self.active_streams:
            return False
        
        stream = self.active_streams[printer_id]
        process = stream['process']
        
        # Prüfe ob Prozess noch läuft
        if process is None or process.poll() is not None:
            return False
        
        # Prüfe auf FFmpeg-Fehler
        error_output = process.stderr.read().decode()
        if 'Connection refused' in error_output:
            return False
        
        return True

# Globale Instanz
stream_service = StreamService()

def getNextPort():
    """Findet den nächsten freien Port für einen Stream"""
    used_ports = set(stream['port'] for stream in stream_service.active_streams.values())
    
    for port in range(stream_service.BASE_PORT, stream_service.BASE_PORT + 100):
        if port not in used_ports:
            return port
            
    raise Exception("Keine freien Ports verfügbar")

def stopStream(printer_id):
    """Kompatibilitätsfunktion"""
    return stream_service.stop_stream(printer_id)

def startStream(printer_id, stream_url=None):
    """Startet einen neuen RTSP zu WebSocket Stream"""
    try:
        if not stream_url:
            from .printerService import getPrinterById
            printer = getPrinterById(printer_id)
            if not printer:
                raise Exception("Drucker nicht gefunden")
            stream_url = printer['streamUrl']
            
        port = getNextPort()
        return stream_service.start_stream(printer_id, stream_url)
        
    except Exception as e:
        logger.error(f"Fehler beim Starten des Streams: {str(e)}")
        raise e

# Verschiebe diese Route in app.py
# @app.route('/stream/<printer_id>/stop', methods=['POST'])
# def stop_stream_endpoint(printer_id):
#     """Stoppt einen laufenden Stream"""
#     try:
#         stopStream(printer_id)
#         return jsonify({'success': True})
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500 