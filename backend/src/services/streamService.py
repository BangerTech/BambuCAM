import asyncio
import websockets
import json
import subprocess
import threading
import logging
from pathlib import Path
from threading import Thread
import time
from flask import jsonify
from .printerService import getPrinterById as get_printer

logger = logging.getLogger(__name__)

class StreamService:
    def __init__(self):
        self.active_streams = {}
        self.ws_servers = {}
        self.BASE_PORT = 9000

    def start_stream(self, printer_id: str, url: str) -> dict:
        """Startet einen neuen Stream"""
        try:
            logger.info(f"Starting stream for {printer_id} with URL {url}")
            
            # Stoppe existierenden Stream falls vorhanden
            self.stop_stream(printer_id)
            
            # Hole Drucker-Konfiguration
            printer = get_printer(printer_id)
            if not printer:
                raise Exception("Printer not found")
            
            # Hole nächsten freien Port
            port = self.get_next_port()
            
            # FFmpeg Befehl für fragmentiertes MP4 mit direkter H.264-Kopie
            command = [
                'ffmpeg',
                '-fflags', 'nobuffer',
                '-flags', 'low_delay',
                '-rtsp_transport', 'tcp',
                '-i', url,
                '-c:v', 'copy',  # Direkte Kopie des H.264-Streams
                '-movflags', 'frag_keyframe+empty_moov+default_base_moof+faststart',
                '-f', 'mp4',
                '-frag_duration', '250000',  # 250ms pro Fragment für flüssigeres Streaming
                '-max_delay', '250000',
                '-max_interleave_delta', '250000',
                'pipe:1'
            ]

            logger.info(f"Starting FFmpeg with command: {' '.join(command)}")
            
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Prüfe ob FFmpeg erfolgreich gestartet
            time.sleep(1)
            if process.poll() is not None:
                error = process.stderr.read().decode()
                logger.error(f"FFmpeg failed to start: {error}")
                return {
                    'success': False,
                    'error': 'Failed to start FFmpeg'
                }
            
            # Lese erste Fehlerausgabe
            error = process.stderr.read1(4096).decode()
            if error:
                logger.info(f"FFmpeg output: {error}")
            
            logger.info("FFmpeg process started successfully")
            
            self.active_streams[printer_id] = {
                'process': process,
                'port': port,
                'url': url
            }

            # Starte WebSocket Server
            if not self.ws_servers.get(port):
                self.start_websocket_server(port)
            
            return {
                'success': True,
                'port': port
            }
        
        except Exception as e:
            logger.error(f"Error starting stream: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def start_websocket_server(self, port: int = 9000):
        """Startet den WebSocket-Server"""
        try:
            logger.info(f"Starting WebSocket server on port {port}")
            
            # Prüfe ob der Port bereits verwendet wird
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('127.0.0.1', port))
            if result == 0:
                logger.warning(f"Port {port} is already in use!")
            sock.close()
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            start_server = websockets.serve(
                self.handle_stream,
                "0.0.0.0",
                port,
                ping_interval=30,
                ping_timeout=10
            )
            
            loop.run_until_complete(start_server)
            
            def run_loop():
                try:
                    loop.run_forever()
                except Exception as e:
                    logger.error(f"Error in WebSocket server loop: {e}", exc_info=True)
            
            server_thread = Thread(target=run_loop, daemon=True)
            server_thread.start()
            
            self.ws_servers[port] = {
                'loop': loop,
                'thread': server_thread
            }
            
            logger.info(f"WebSocket server successfully started on port {port}")
            
        except Exception as e:
            logger.error(f"Error starting WebSocket server: {e}", exc_info=True)

    async def handle_stream(self, websocket, path):
        """Behandelt einen einzelnen WebSocket Stream"""
        try:
            printer_id = path.split('/')[-1]
            logger.info(f"WebSocket connection attempt for printer {printer_id}")
            logger.info(f"Active streams: {list(self.active_streams.keys())}")
            
            if printer_id not in self.active_streams:
                logger.error(f"No active stream for printer {printer_id}")
                await websocket.close(1008, f"No active stream for printer {printer_id}")
                return
            
            stream_data = self.active_streams[printer_id]
            process = stream_data['process']
            
            logger.info(f"Starting stream data transfer for printer {printer_id}")
            
            while True:
                if process.poll() is not None:
                    error = process.stderr.read().decode()
                    logger.error(f"FFmpeg process ended for printer {printer_id}. Error: {error}")
                    break
                    
                data = process.stdout.read1(32768)
                if not data:
                    logger.debug("No data received from FFmpeg, continuing...")
                    continue
                    
                try:
                    logger.debug(f"Sending {len(data)} bytes of data")
                    await websocket.send(data)
                except websockets.exceptions.ConnectionClosed:
                    logger.info(f"WebSocket connection closed for printer {printer_id}")
                    break
                except Exception as e:
                    logger.error(f"Error sending data: {e}", exc_info=True)
                    break
                
        except Exception as e:
            logger.error(f"Error in stream handler: {e}", exc_info=True)
        finally:
            logger.info(f"Stream handler finished for printer {printer_id}")
            try:
                await websocket.close()
            except:
                pass

    def stop_stream(self, printer_id):
        """Stoppt einen Stream"""
        if printer_id in self.active_streams:
            try:
                stream_data = self.active_streams[printer_id]
                process = stream_data['process']
                if process:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except:
                        process.kill()
                del self.active_streams[printer_id]
            except Exception as e:
                logger.error(f"Error stopping stream: {e}")

    def get_next_port(self):
        """Findet den nächsten freien Port"""
        used_ports = set(stream['port'] for stream in self.active_streams.values())
        
        for port in range(self.BASE_PORT, self.BASE_PORT + 100):
            if port not in used_ports:
                return port
                
        raise Exception("Keine freien Ports verfügbar")

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