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
        self.BASE_PORT = 9000

    def start_stream(self, printer_id, stream_url, port):
        """Startet einen neuen Stream"""
        try:
            logger.info(f"Starting new stream for printer {printer_id}")
            
            # Stoppe existierenden Stream falls vorhanden
            self.stop_stream(printer_id)
            
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

            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=10**8
            )

            self.active_streams[printer_id] = {
                'process': process,
                'port': port,
                'url': stream_url
            }

            # Starte WebSocket Server
            if not self.ws_servers.get(port):
                self.start_websocket_server(port)

            return port

        except Exception as e:
            logger.error(f"Error starting stream: {e}")
            raise e

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
            
        process = self.active_streams[printer_id]['process']
        
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

    def stop_stream(self, printer_id):
        """Stoppt einen Stream"""
        if printer_id in self.active_streams:
            try:
                process = self.active_streams[printer_id]['process']
                if process:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except:
                        process.kill()
                del self.active_streams[printer_id]
            except Exception as e:
                logger.error(f"Error stopping stream: {e}")

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