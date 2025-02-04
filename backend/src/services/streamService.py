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
from threading import Thread

logger = logging.getLogger(__name__)

class StreamService:
    def __init__(self):
        self.active_streams = {}
        
    async def stream_handler(self, websocket, path):
        """Behandelt WebSocket-Verbindungen"""
        try:
            # Extrahiere printer_id aus dem Pfad
            printer_id = path.split('/')[-1]
            if printer_id not in self.active_streams:
                await websocket.close(1008, "Stream nicht gefunden")
                return
                
            stream = self.active_streams[printer_id]
            process = stream['process']
            
            # Lese FFMPEG Output und sende an WebSocket
            while True:
                data = await asyncio.get_event_loop().run_in_executor(
                    None, process.stdout.read, 4096
                )
                if not data:
                    break
                await websocket.send(data)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
        except Exception as e:
            logger.error(f"Error in stream handler: {e}")
            
    def start_websocket_server(self, port):
        """Startet den WebSocket-Server"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        start_server = websockets.serve(
            self.stream_handler, 
            "0.0.0.0", 
            port,
            ping_interval=None
        )
        
        loop.run_until_complete(start_server)
        loop.run_forever()
        
    def start_stream(self, printer_id, stream_url, port):
        """Startet einen neuen RTSP Stream"""
        try:
            command = [
                'ffmpeg',
                '-rtsp_transport', 'tcp',
                '-i', stream_url,
                '-c:v', 'copy',
                '-f', 'mpegts',
                'pipe:1'
            ]
            
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=10**8
            )
            
            self.active_streams[printer_id] = {
                'process': process,
                'port': port
            }
            
            # Starte WebSocket-Server in separatem Thread
            ws_thread = Thread(
                target=self.start_websocket_server,
                args=(port,)
            )
            ws_thread.daemon = True
            ws_thread.start()
            
            return port
            
        except Exception as e:
            logger.error(f"Error starting stream: {e}")
            raise e
            
    def stop_stream(self, printer_id):
        """Stoppt einen Stream"""
        if printer_id in self.active_streams:
            try:
                stream = self.active_streams[printer_id]
                stream['process'].terminate()
                del self.active_streams[printer_id]
            except Exception as e:
                logger.error(f"Error stopping stream: {e}")

# Globale Stream-Service Instanz
stream_service = StreamService()

# Starte WebSocket-Server in einem separaten Thread
ws_thread = threading.Thread(target=stream_service.start_websocket_server)
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