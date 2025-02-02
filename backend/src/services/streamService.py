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

    def start_ffmpeg_stream(self, url, path):
        """Startet FFmpeg für RTSP zu WebSocket Konvertierung"""
        if path not in self.streams:
            self.streams[path] = Queue()
            
            # FFmpeg Kommando für RTSP zu MPEG1
            command = [
                'ffmpeg',
                '-i', url,
                '-f', 'mpegts',
                '-codec:v', 'mpeg1video',
                '-s', '800x600',
                '-b:v', '1000k',
                '-r', '30',
                '-bf', '0',
                '-codec:a', 'mp2',
                '-ar', '44100',
                '-ac', '1',
                '-b:a', '128k',
                '-'
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

def startStream(printer_id):
    try:
        path = f"/stream/{printer_id}"
        
        # Hole Drucker-Daten
        printer = stored_printers.get(printer_id)
        if not printer:
            raise Exception(f"Printer {printer_id} not found")
            
        # Extrahiere Nummer aus ID
        printer_number = printer_id.split('_')[-1]
        
        # Prüfe ob es ein Mock-Printer ist
        is_mock = "mock" in printer_id.lower()
        is_normal = printer_number == "4"  # Printer 4 ist der normale Drucker
        
        # Generiere die passende URL basierend auf Drucker-Daten
        if is_mock:
            port = f"855{printer_number}"
            if is_normal:
                # Normaler RTSP-Stream
                url = f"rtsp://{printer['ip']}:{port}/stream1"
            else:
                # Bambulab-Style Stream
                url = f"rtsps://bblp:{printer['accessCode']}@{printer['ip']}:{port}/streaming/live/1"
        else:
            # Echter Bambulab Drucker
            url = f"rtsps://bblp:{printer['accessCode']}@{printer['ip']}:322/streaming/live/1"
            
        print(f"Starting stream from URL: {url}")
        stream_manager.start_ffmpeg_stream(url, path)
        return stream_manager.ws_port
    except Exception as e:
        print(f"Error starting stream: {e}")
        return None 