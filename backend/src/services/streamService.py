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
from .printerService import stored_printers, getPrinters
import logging
from pathlib import Path
from threading import Thread
import time

logger = logging.getLogger(__name__)

class StreamService:
    def __init__(self):
        self.active_streams = {}
        self.ws_servers = {}
        self.server_lock = threading.Lock()
        self.main_loop = None
        self.main_thread = None
        self.max_retries = 5  # Maximale Anzahl von Neustartversuchen
        self.retry_count = {}  # Zähler für Neustartversuche pro Drucker
        
    def start_stream(self, printer_id, stream_url, port):
        """Startet einen neuen RTSP Stream"""
        try:
            logger.info(f"Starting new stream for printer {printer_id}")
            
            # Stoppe existierenden Stream falls vorhanden
            self.stop_stream(printer_id)
            
            # Optimierter FFmpeg Befehl für Bambulab Kameras
            command = [
                'ffmpeg',
                '-fflags', 'nobuffer',
                '-flags', 'low_delay',
                '-rtsp_transport', 'tcp',
                '-i', stream_url,
                '-vsync', '0',
                '-c:v', 'copy',     # Direkte Kopie des H.264 Streams
                '-max_delay', '0',
                '-an',              # Kein Audio
                '-f', 'mpegts',     # MPEG-TS Format
                '-flush_packets', '1',
                'pipe:1'            # Ausgabe an stdout
            ]
            
            logger.info(f"Starting FFmpeg with command: {' '.join(command)}")
            
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=10**8
            )
            
            # Speichere Stream-Info
            self.active_streams[printer_id] = {
                'process': process,
                'port': port,
                'url': stream_url
            }
            
            # Starte WebSocket-Server falls nötig
            with self.server_lock:
                if not self.main_loop or not self.main_loop.is_running():
                    self.start_main_server(port)
            
            return port
            
        except Exception as e:
            logger.error(f"Failed to start stream: {e}")
            raise e

    def start_main_server(self, port):
        """Startet den Haupt-WebSocket-Server"""
        try:
            if self.main_loop and self.main_loop.is_running():
                return

            self.main_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.main_loop)
            
            start_server = websockets.serve(
                self.stream_handler, 
                "0.0.0.0", 
                port,
                ping_interval=None
            )
            
            self.main_loop.run_until_complete(start_server)
            
            def run_loop():
                asyncio.set_event_loop(self.main_loop)
                self.main_loop.run_forever()
            
            self.main_thread = threading.Thread(target=run_loop, daemon=True)
            self.main_thread.start()
            
            logger.info(f"Started main WebSocket server on port {port}")
            
        except Exception as e:
            logger.error(f"Error starting main server: {e}")
            if self.main_loop:
                self.main_loop.close()
            self.main_loop = None
            self.main_thread = None
            raise e

    async def stream_handler(self, websocket, path):
        """Behandelt WebSocket-Verbindungen"""
        try:
            printer_id = path.split('/')[-1]
            logger.info(f"Stream handler called for printer {printer_id}")
            
            # Hole Drucker-Info
            printers = getPrinters()
            printer = next((p for p in printers if p['id'] == printer_id), None)
            
            if not printer:
                logger.error(f"No printer found with ID {printer_id}")
                await websocket.close(1008, "Printer not found")
                return

            # Stoppe immer den alten Stream
            if printer_id in self.active_streams:
                logger.info("Stopping existing stream before starting new one")
                self.stop_stream(printer_id)

            # Starte neuen Stream
            logger.info(f"Starting new stream for {printer_id}")
            try:
                self.start_stream(printer_id, printer['streamUrl'], 9000)
                logger.info("Stream started successfully")
            except Exception as e:
                logger.error(f"Failed to start stream: {e}")
                await websocket.close(1008, "Failed to start stream")
                return

            stream = self.active_streams[printer_id]
            process = stream['process']
            
            logger.info(f"Using stream process (PID: {process.pid})")
            
            # Reset retry counter when stream starts successfully
            self.retry_count[printer_id] = 0

            # Verbesserte Timeout-Prüfung
            last_data_time = time.time()
            TIMEOUT_SECONDS = 10
            MIN_DATA_SIZE = 1024  # Minimale Datengröße für gültigen Stream

            while True:
                try:
                    data = await asyncio.get_event_loop().run_in_executor(
                        None, process.stdout.read, 4096
                    )
                    
                    current_time = time.time()
                    
                    # Prüfe auf Timeout oder zu kleine Datenpakete
                    if not data or len(data) < MIN_DATA_SIZE or current_time - last_data_time > TIMEOUT_SECONDS:
                        logger.warning("Stream timeout or invalid data, restarting...")
                        self.stop_stream(printer_id)  # Stoppe alten Stream sauber
                        await asyncio.sleep(1)  # Kurze Pause vor Neustart
                        self.start_stream(printer_id, printer['streamUrl'], 9000)
                        process = self.active_streams[printer_id]['process']
                        logger.info(f"Stream restarted (new PID: {process.pid})")
                        last_data_time = time.time()
                        continue

                    await websocket.send(data)
                    last_data_time = current_time

                except websockets.exceptions.ConnectionClosed:
                    logger.info("Client disconnected")
                    break
                except Exception as e:
                    logger.error(f"Stream error: {e}")
                    
                    # Increment retry counter
                    self.retry_count[printer_id] = self.retry_count.get(printer_id, 0) + 1
                    
                    # Check if max retries reached
                    if self.retry_count[printer_id] >= self.max_retries:
                        logger.error(f"Max retries ({self.max_retries}) reached for printer {printer_id}")
                        self.retry_count[printer_id] = 0  # Reset counter
                        return  # Stop retrying
                        
                    logger.warning(f"Stream ended, retry {self.retry_count[printer_id]}/{self.max_retries}...")
                    break
                    
        except Exception as e:
            logger.error(f"Handler error: {e}")
        finally:
            logger.info("Stream handler finished")
        
    def stop_stream(self, printer_id):
        """Stoppt einen Stream"""
        if printer_id in self.active_streams:
            try:
                stream = self.active_streams[printer_id]
                logger.info(f"Stopping stream process (PID: {stream['process'].pid})")
                
                # Beende Prozess und warte auf Ende
                stream['process'].terminate()
                try:
                    stream['process'].wait(timeout=5)
                except subprocess.TimeoutExpired:
                    logger.warning("Stream process did not terminate, killing it")
                    stream['process'].kill()
                
                del self.active_streams[printer_id]
                logger.info("Stream stopped successfully")
            except Exception as e:
                logger.error(f"Error stopping stream: {e}")

# Globale Stream-Service Instanz
stream_service = StreamService()

# Aktive Streams und deren Prozesse
active_streams = {}
# Start-Port für WebSocket-Verbindungen
BASE_PORT = 9000
# Maximale Anzahl an gleichzeitigen Streams
MAX_STREAMS = 100

def getNextPort():
    """Findet den nächsten freien Port für einen Stream"""
    used_ports = set(stream['port'] for stream in active_streams.values())
    
    for port in range(BASE_PORT, BASE_PORT + MAX_STREAMS):
        if port not in used_ports:
            return port
            
    raise Exception("Keine freien Ports verfügbar")

def stopStream(printer_id):
    """Stoppt einen laufenden Stream"""
    if printer_id in active_streams:
        try:
            process = active_streams[printer_id]['process']
            process.terminate()
            process.wait(timeout=5)
        except:
            # Falls der Prozess nicht reagiert, hart beenden
            try:
                process.kill()
            except:
                pass
        finally:
            del active_streams[printer_id]

def startStream(printer_id, stream_url=None):
    """Startet einen neuen RTSP zu WebSocket Stream"""
    try:
        if not stream_url:
            printer = getPrinterById(printer_id)
            if not printer:
                raise Exception("Drucker nicht gefunden")
            stream_url = printer['streamUrl']
            
        port = getNextPort()
        
        # Stoppe existierenden Stream falls vorhanden
        stopStream(printer_id)
        
        # Starte FFmpeg Prozess
        command = [
            'ffmpeg',
            '-fflags', 'nobuffer',
            '-flags', 'low_delay',
            '-strict', 'experimental',
            '-rtsp_transport', 'tcp',  # TCP für stabilere Verbindung
            '-i', stream_url,
            '-vsync', '0',
            '-copyts',
            '-vcodec', 'copy',
            '-movflags', 'frag_keyframe+empty_moov',
            '-an',
            '-hls_flags', 'delete_segments+append_list',
            '-f', 'mpegts',
            f'http://localhost:{port}'
        ]
        
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Speichere Prozess-ID
        active_streams[printer_id] = {
            'process': process,
            'port': port
        }
        
        return port
        
    except Exception as e:
        logger.error(f"Fehler beim Starten des Streams: {str(e)}")
        raise e 