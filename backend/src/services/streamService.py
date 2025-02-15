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

logger = logging.getLogger(__name__)

class StreamService:
    def __init__(self):
        self.active_streams = {}
        self.ws_servers = {}
        self.BASE_PORT = 9000

    def start_stream(self, printer_id, stream_url, port):
        """Startet einen neuen Stream"""
        try:
            logger.info(f"Starting stream for {printer_id} with URL {stream_url}")
            
            # Extra Sicherheitscheck
            if port in self.ws_servers:
                logger.warning(f"Port {port} already has a server, forcing cleanup...")
                try:
                    server_info = self.ws_servers[port]
                    server_info['loop'].stop()
                    server_info['thread'].join(timeout=1)
                    del self.ws_servers[port]
                    time.sleep(1)  # Extra wait
                except Exception as e:
                    logger.error(f"Error cleaning up old server: {e}")
                    return False
            
            # Stoppe existierenden Stream falls vorhanden
            self.stop_stream(printer_id)
            
            # Extra check für WebSocket server
            if port in self.ws_servers:
                logger.warning(f"WebSocket server on port {port} still exists after cleanup")
                try:
                    server_info = self.ws_servers[port]
                    server_info['loop'].stop()
                    server_info['thread'].join(timeout=1)
                    del self.ws_servers[port]
                    # Extra Wartezeit für Port-Freigabe
                    time.sleep(1)
                except Exception as e:
                    logger.error(f"Error cleaning up existing WebSocket server: {e}")
                    return False
            
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
                bufsize=10*1024*1024  # 10MB Buffer
            )
            
            # Prüfe ob FFmpeg erfolgreich gestartet
            time.sleep(1)
            if process.poll() is not None:
                error = process.stderr.read().decode()
                logger.error(f"FFmpeg failed to start: {error}")
                return False
            
            # Lese erste Fehlerausgabe auch wenn Prozess läuft
            error = process.stderr.read1(4096).decode()
            if error:
                logger.info(f"FFmpeg output: {error}")
            
            logger.info("FFmpeg process started successfully")
            
            self.active_streams[printer_id] = {
                'process': process,
                'port': port,
                'url': stream_url
            }

            # Starte WebSocket Server
            try:
                self.start_websocket_server(port)
                logger.info(f"WebSocket server started successfully on port {port}")
                return port
            except Exception as e:
                logger.error(f"Failed to start WebSocket server: {e}")
                self.stop_stream(printer_id)
                return False
        
        except Exception as e:
            logger.error(f"Error starting stream: {e}")
            return False

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
        """Behandelt einen einzelnen WebSocket Stream"""
        printer_id = path.split('/')[-1]
        logger.info(f"Stream handler called for printer {printer_id}")
        
        if printer_id not in self.active_streams:
            return
            
        stream_data = self.active_streams[printer_id]
        process = stream_data['process']
        
        try:
            while True:
                if process.poll() is not None:
                    break
                    
                data = process.stdout.read1(32768)
                if not data:
                    continue
                    
                try:
                    await websocket.send(data)
                except websockets.exceptions.ConnectionClosed:
                    break
                except Exception as e:
                    logger.error(f"Error sending data: {e}")
                    break
                    
        except Exception as e:
            logger.error(f"Error in stream handler: {e}")
        finally:
            try:
                await websocket.close()
            except:
                pass

    def stop_stream(self, printer_id, force=False):
        """Stoppt einen Stream mit verbessertem Cleanup"""
        if printer_id in self.active_streams:
            try:
                logger.info(f"Stopping stream for printer {printer_id} (force={force})")
                stream_data = self.active_streams[printer_id]
                process = stream_data['process']
                port = stream_data['port']
                
                # Wichtig: Erst WebSocket Server stoppen, dann FFmpeg
                if port in self.ws_servers:
                    logger.info(f"Cleaning up WebSocket server on port {port}")
                    try:
                        server_info = self.ws_servers[port]
                        # Event Loop in Thread stoppen
                        server_info['loop'].call_soon_threadsafe(server_info['loop'].stop)
                        # Thread beenden
                        server_info['thread'].join(timeout=1)
                        del self.ws_servers[port]
                        logger.info(f"WebSocket server cleanup completed for port {port}")
                    except Exception as e:
                        logger.error(f"Error during WebSocket cleanup: {e}")
                        # Force cleanup
                        if port in self.ws_servers:
                            del self.ws_servers[port]

                # 2. Then cleanup FFmpeg process
                if process:
                    if force:
                        logger.info("Force killing FFmpeg process")
                        process.kill()
                    else:
                        logger.info("Gracefully stopping FFmpeg process")
                        process.terminate()
                        
                    try:
                        process.wait(timeout=1)
                    except:
                        logger.warning("Process timeout, force killing")
                        process.kill()
                        process.wait()

                # 3. Final cleanup
                del self.active_streams[printer_id]
                logger.info(f"Stream cleanup completed for printer {printer_id}")
                
            except Exception as e:
                logger.error(f"Error during stream cleanup: {e}")
                # Force cleanup
                if printer_id in self.active_streams:
                    del self.active_streams[printer_id]

    async def _close_websocket_connections(self, port):
        """Hilfsfunktion zum sauberen Schließen aller WebSocket Verbindungen"""
        try:
            if port in self.ws_servers:
                server_info = self.ws_servers[port]
                # Hier könnten wir alle aktiven WebSocket Verbindungen schließen
                # Wenn wir sie in einer Liste speichern würden
                logger.info(f"Closing all connections for port {port}")
        except Exception as e:
            logger.error(f"Error closing WebSocket connections: {e}")

    def restart_stream(self, printer_id):
        try:
            logger.info(f"\n=== Starting stream reset for printer {printer_id} ===")
            
            if printer_id not in self.active_streams:
                return False
            
            old_stream = self.active_streams[printer_id]
            old_port = old_stream['port']
            stream_url = old_stream['url']
            
            # 1. Starte neuen Stream parallel
            new_port = self.get_next_free_port()
            temp_id = f"{printer_id}_temp_{int(time.time())}"
            
            logger.info(f"Starting new stream on port {new_port}")
            success = self.start_stream(temp_id, stream_url, new_port)
            
            if not success:
                logger.error("Failed to start new stream")
                return False
            
            # 2. Aktualisiere Stream-Info sofort
            if temp_id in self.active_streams:
                logger.info(f"Updating stream info: {new_port} -> {printer_id}")
                old_stream_backup = self.active_streams[printer_id]
                self.active_streams[printer_id] = self.active_streams[temp_id]
                del self.active_streams[temp_id]
                
                # 3. Sende Port-Update ans Frontend
                result = {
                    'success': True,
                    'new_port': new_port
                }
                
                # 4. Beende alten Stream asynchron
                def cleanup_old_stream():
                    try:
                        logger.info(f"Cleaning up old stream on port {old_port}")
                        if 'process' in old_stream_backup:
                            old_stream_backup['process'].kill()
                        if old_port in self.ws_servers:
                            server_info = self.ws_servers[old_port]
                            server_info['loop'].call_soon_threadsafe(server_info['loop'].stop)
                            server_info['thread'].join(timeout=1)
                            del self.ws_servers[old_port]
                    except Exception as e:
                        logger.error(f"Error cleaning up old stream: {e}")
                    
                Thread(target=cleanup_old_stream, daemon=True).start()
                
                return result
            
            return False
            
        except Exception as e:
            logger.error(f"Error during stream reset: {e}")
            return False

    def get_next_free_port(self):
        """Findet den nächsten freien Port"""
        used_ports = set(stream['port'] for stream in self.active_streams.values())
        for port in range(9000, 9100):  # Port-Range 9000-9099
            if port not in used_ports:
                return port
        raise Exception("No free ports available")

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
        return stream_service.start_stream(printer_id, stream_url, port)
        
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