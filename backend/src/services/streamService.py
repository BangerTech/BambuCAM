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
from .printerService import stored_printers
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class StreamManager:
    def __init__(self):
        self.streams = {}
        self.ws_port = int(os.getenv('WS_PORT', '9000'))  # Port aus Umgebungsvariable

    async def handle_websocket(self, websocket, path):
        """Handhabt WebSocket-Verbindungen"""
        try:
            while True:
                if path in self.streams:
                    data = await self.streams[path].get()
                    await websocket.send(data)
                await asyncio.sleep(0.001)
        except websockets.exceptions.ConnectionClosed:
            print(f"WebSocket connection closed for {path}")

    def start_stream_server(self):
        """Startet den WebSocket-Server"""
        retries = 5
        current_port = self.ws_port

        while retries > 0:
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                start_server = websockets.serve(
                    self.handle_websocket, 
                    "0.0.0.0", 
                    current_port
                )
                
                loop.run_until_complete(start_server)
                print(f"WebSocket server started on port {current_port}")
                self.ws_port = current_port  # Speichere den erfolgreichen Port
                loop.run_forever()
                break
            except OSError as e:
                print(f"Port {current_port} in use, trying next port")
                current_port += 1
                retries -= 1
                if retries == 0:
                    raise Exception("Could not find available port")

    def start_ffmpeg_stream(self, url, path, ssl_verify=True):
        """Startet FFmpeg für RTSP zu WebSocket Konvertierung"""
        if path not in self.streams:
            self.streams[path] = Queue()
            
            # Optimierte FFmpeg Parameter basierend auf der Dokumentation
            command = [
                'ffmpeg',
                '-fflags', 'nobuffer',
                '-flags', 'low_delay',
                '-rtsp_transport', 'tcp',
                '-rtsp_flags', 'prefer_tcp',
                '-allowed_media_types', 'video',
                '-i', url,
                '-c:v', 'mpeg1video',     # Wichtig: MPEG1 für JSMpeg
                '-f', 'mpegts',           # MPEG-TS Format
                '-b:v', '800k',           # Bitrate wie in den Logs
                '-maxrate', '1000k',
                '-bufsize', '2000k',
                '-an',                    # Kein Audio
                '-tune', 'zerolatency',
                '-preset', 'ultrafast',
                'pipe:1'
            ]
            
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            def read_output():
                while True:
                    data = process.stdout.read(4096)
                    if not data:
                        break
                    self.streams[path].put_nowait(data)
            
            thread = threading.Thread(target=read_output)
            thread.daemon = True
            thread.start()

# Globale Stream-Manager Instanz
stream_manager = StreamManager()

# Starte WebSocket-Server in einem separaten Thread
ws_thread = threading.Thread(target=stream_manager.start_stream_server)
ws_thread.daemon = True
ws_thread.start()

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