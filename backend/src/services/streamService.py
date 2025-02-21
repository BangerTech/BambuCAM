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
        self.active_streams = {}  # Format: {printer_id: {port: int, process: Process, ws_server: WebSocketServer}}
        self.BASE_PORT = 9000
        self.port_lock = threading.Lock()  # Thread-safe Port-Verwaltung
        self.next_port = self.BASE_PORT
        self.CHUNK_SIZE = 65536  # 64KB Chunks
        
        # Event Loop in separatem Thread
        self.loop = None
        self.ws_thread = Thread(target=self._run_websocket_server)
        self.ws_thread.daemon = True
        self.ws_thread.start()
        
        # Warte bis Event Loop bereit ist
        while self.loop is None:
            time.sleep(0.1)

    def _run_websocket_server(self):
        """Event Loop in separatem Thread"""
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    def get_next_port(self):
        """Findet den nächsten freien Port für einen Stream"""
        used_ports = set(stream['port'] for stream in self.active_streams.values())
        
        # Suche den nächsten freien Port
        for port in range(self.BASE_PORT, self.BASE_PORT + 100):
            if port not in used_ports:
                return port
        raise Exception("Keine freien Ports verfügbar")

    def start_stream(self, printer_id: str, stream_url: str = None) -> dict:
        try:
            if not stream_url:
                logger.error("No stream URL provided")
                return {'success': False, 'error': 'No stream URL provided'}

            logger.info(f"Starting stream for {printer_id}")
            
            # Hole Drucker-Informationen
            from .printerService import getPrinterById
            printer = getPrinterById(printer_id)
            if not printer:
                return {'success': False, 'error': 'Printer not found'}

            # Für OctoPrint und Creality direkt die Stream-URL zurückgeben
            if printer['type'] in ['OCTOPRINT', 'CREALITY']:
                logger.info(f"Direct MJPEG stream for {printer['type']}")
                return {
                    'success': True,
                    'direct': True,
                    'url': stream_url
                }

            # Für andere Drucker (Bambu Lab) FFmpeg verwenden
            self.stop_stream(printer_id)  # Cleanup alter Stream
            
            # FFmpeg mit Retry
            process = self._start_ffmpeg(stream_url)
            
            # WebSocket Server im Event Loop erstellen
            port = self.get_next_port()
            future = asyncio.run_coroutine_threadsafe(
                self._create_ws_server(process, port),
                self.loop
            )
            future.result()  # Warte auf Server-Start
            
            # Stream-Überwachung
            monitor_future = asyncio.run_coroutine_threadsafe(
                self._monitor_stream(printer_id, stream_url, process),
                self.loop
            )
            
            self.active_streams[printer_id] = {
                'process': process,
                'port': port,
                'url': stream_url,
                'monitor_task': monitor_future
            }
            
            return {
                'success': True,
                'direct': False,
                'port': port,
                'url': f'ws://localhost:{port}'
            }

        except Exception as e:
            logger.error(f"Error starting stream: {e}")
            return {'success': False, 'error': str(e)}

    def _start_ffmpeg(self, url: str):
        """Startet FFmpeg mit korrekten Parametern"""
        try:
            logger.info(f"Starting FFmpeg stream from URL: {url}")
            
            # Unterschiedliche Parameter für MJPEG und RTSP
            if 'action=stream' in url:  # MJPEG Stream (OctoPrint/Creality)
                logger.info("Detected MJPEG stream, using MJPEG parameters")
                cmd = [
                    'ffmpeg',
                    '-f', 'mjpeg',
                    '-reconnect', '1',
                    '-reconnect_streamed', '1',
                    '-reconnect_delay_max', '5',
                    '-i', url,
                    '-c:v', 'copy',
                    '-f', 'mp4',
                    '-movflags', 'frag_keyframe+empty_moov',
                    'pipe:1'
                ]
            else:  # RTSP Stream (Bambu Lab)
                logger.info("Detected RTSP stream, using RTSP parameters")
                cmd = [
                    'ffmpeg',
                    '-fflags', 'nobuffer',
                    '-flags', 'low_delay',
                    '-rtsp_transport', 'tcp',
                    '-i', url,
                    '-c:v', 'copy',
                    '-f', 'mp4',
                    '-movflags', 'frag_keyframe+empty_moov',
                    'pipe:1'
                ]
            
            logger.debug(f"FFmpeg command: {' '.join(cmd)}")
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=10**8
            )
            
            # Warte kurz und prüfe ob FFmpeg gestartet ist
            time.sleep(1)
            if process.poll() is not None:
                error = process.stderr.read().decode()
                logger.error(f"FFmpeg failed to start: {error}")
                raise Exception(f"FFmpeg failed to start: {error}")
                
            logger.info("FFmpeg process started successfully")
            return process
            
        except Exception as e:
            logger.error(f"FFmpeg start error: {str(e)}", exc_info=True)
            raise

    async def _monitor_stream(self, printer_id: str, url: str, process):
        """Überwacht den Stream und handhabt Neustarts"""
        restart_count = 0
        max_restarts = 3
        
        while True:
            try:
                if process.poll() is not None:
                    logger.warning(f"Stream {printer_id} died, checking restart...")
                    
                    if restart_count >= max_restarts:
                        logger.error(f"Stream {printer_id} failed after {max_restarts} restarts")
                        break
                        
                    restart_count += 1
                    logger.info(f"Restarting stream {printer_id} (attempt {restart_count}/{max_restarts})")
                    
                    # Cleanup
                    self.stop_stream(printer_id)
                    await asyncio.sleep(2)  # Warte vor Neustart
                    
                    # Neustart
                    success = self.start_stream(printer_id, url)
                    if not success:
                        logger.error("Stream restart failed")
                        continue
                        
                    logger.info(f"Stream {printer_id} successfully restarted")
                    break
                    
                await asyncio.sleep(1)
                restart_count = 0  # Reset nach erfolgreicher Periode
                
            except Exception as e:
                logger.error(f"Monitor error: {e}")
                await asyncio.sleep(5)

    async def handle_websocket(self, websocket, path, process):
        """Handhabt WebSocket-Verbindung mit optimiertem Buffering"""
        try:
            logger.info(f"New WebSocket connection on {path}")
            last_data = time.time()
            
            while True:
                if process.poll() is not None:
                    logger.warning("FFmpeg process died")
                    break
                
                try:
                    data = await self.loop.run_in_executor(
                        None, 
                        process.stdout.read1, 
                        self.CHUNK_SIZE
                    )
                    
                    if not data:
                        if time.time() - last_data > 5:
                            logger.warning("No data for 5 seconds")
                            break
                        await asyncio.sleep(0.1)
                        continue
                    
                    last_data = time.time()
                    await websocket.send(data)
                    
                except websockets.exceptions.ConnectionClosed:
                    logger.info("WebSocket connection closed by client")
                    break
                except Exception as e:
                    logger.error(f"Send error: {e}")
                    break
                    
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
        finally:
            logger.info("Closing WebSocket connection")
            await websocket.close()

    async def _create_ws_server(self, process, port):
        """Erstellt einen WebSocket Server"""
        server = await websockets.serve(
            lambda ws, path: self.handle_websocket(ws, path, process),
            "0.0.0.0",
            port
        )
        return server

    def stop_stream(self, printer_id):
        """Stoppt einen Stream sauber"""
        if printer_id in self.active_streams:
            try:
                stream = self.active_streams[printer_id]
                # Stoppe Monitor Task
                if 'monitor_task' in stream:
                    stream['monitor_task'].cancel()
                # Stoppe FFmpeg
                process = stream['process']
                process.terminate()
                try:
                    process.wait(timeout=5)
                except:
                    process.kill()
                del self.active_streams[printer_id]
            except Exception as e:
                logger.error(f"Stop stream error: {e}")

    def cleanup_stream(self, printer_id: str):
        """Säubert einen Stream und gibt seinen Port frei"""
        if printer_id in self.active_streams:
            stream = self.active_streams[printer_id]
            if stream['process']:
                stream['process'].terminate()
            if stream['ws_server']:
                stream['ws_server'].close()
            del self.active_streams[printer_id]

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
        success = stream_service.start_stream(printer_id, stream_url)
        if success:
            return {'success': True, 'port': port}  # Port muss zurückgegeben werden
        return {'success': False, 'error': 'Stream start failed'}
        
    except Exception as e:
        logger.error(f"Fehler beim Starten des Streams: {str(e)}")
        return {'success': False, 'error': str(e)}

# Verschiebe diese Route in app.py
# @app.route('/stream/<printer_id>/stop', methods=['POST'])
# def stop_stream_endpoint(printer_id):
#     """Stoppt einen laufenden Stream"""
#     try:
#         stopStream(printer_id)
#         return jsonify({'success': True})
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500 