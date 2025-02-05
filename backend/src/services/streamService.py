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
import time

logger = logging.getLogger(__name__)

class StreamService:
    def __init__(self):
        self.active_streams = {}
        self.ws_servers = {}
        self.server_running = False  # Neuer Flag für Server-Status
        
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
            
            logger.info(f"Client connected to stream {printer_id}")
            
            # Lese FFMPEG Output und sende an WebSocket
            while True:
                try:
                    # Lese Chunks von 4KB
                    data = await asyncio.get_event_loop().run_in_executor(
                        None, process.stdout.read, 4096
                    )
                    
                    if not data:
                        logger.warning("FFmpeg stream ended")
                        break
                        
                    await websocket.send(data)
                    
                except websockets.exceptions.ConnectionClosed:
                    logger.info("Client disconnected")
                    break
                except Exception as e:
                    logger.error(f"Error in stream handler: {e}")
                    break
                
        except Exception as e:
            logger.error(f"Error in stream handler: {e}")
        finally:
            logger.info("Stream handler finished")
            
    def start_websocket_server(self, port):
        """Startet den WebSocket-Server"""
        if self.server_running:  # Prüfe ob Server bereits läuft
            return

        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            start_server = websockets.serve(
                self.stream_handler, 
                "0.0.0.0", 
                port,
                ping_interval=None
            )
            
            self.ws_servers[port] = {
                'server': start_server,
                'loop': loop
            }
            
            loop.run_until_complete(start_server)
            self.server_running = True  # Setze Flag
            loop.run_forever()
            
        except OSError as e:
            if e.errno == 98:  # Address already in use
                logger.info("WebSocket server already running")
                self.server_running = True
            else:
                raise e

    def start_stream(self, printer_id, stream_url, port):
        """Startet einen neuen RTSP Stream"""
        try:
            # Stoppe existierenden Stream falls vorhanden
            if printer_id in self.active_streams:
                self.stop_stream(printer_id)

            # FFmpeg Befehl bleibt gleich...
            command = [
                'ffmpeg',
                '-fflags', 'nobuffer',
                '-flags', 'low_delay',
                '-rtsp_transport', 'tcp',
                '-i', stream_url,
                '-vsync', '0',
                '-c:v', 'copy',
                '-max_delay', '0',
                '-an',
                '-f', 'mpegts',
                '-flush_packets', '1',
                'pipe:1'
            ]
            
            logger.info(f"Starting FFmpeg with command: {' '.join(command)}")
            
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=10**8
            )
            
            # Warte kurz und prüfe ob der Prozess läuft
            time.sleep(1)
            if process.poll() is not None:
                _, stderr = process.communicate()
                logger.error(f"FFmpeg process failed: {stderr.decode()}")
                raise Exception("FFmpeg process failed to start")
            
            # Starte WebSocket-Server wenn noch nicht gestartet
            if not self.server_running:
                try:
                    ws_thread = Thread(
                        target=self.start_websocket_server,
                        args=(port,)
                    )
                    ws_thread.daemon = True
                    ws_thread.start()
                    
                    # Warte bis der Server läuft
                    time.sleep(0.5)
                except Exception as e:
                    logger.error(f"Error starting WebSocket server: {e}")
                    process.terminate()
                    raise e
            
            self.active_streams[printer_id] = {
                'process': process,
                'port': port
            }
            
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
                
                # Stoppe auch den WebSocket-Server
                port = stream['port']
                if port in self.ws_servers:
                    self.ws_servers[port]['loop'].stop()
                    del self.ws_servers[port]
                    
                del self.active_streams[printer_id]
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