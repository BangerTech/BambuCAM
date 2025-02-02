import cv2
import time
import numpy as np
from datetime import datetime
import os
import threading
import random
import subprocess
import socket
import struct
from threading import Thread
import json

def generate_printer_info(frame, printer_number, is_bambulab=True):
    """Fügt Drucker-Informationen zum Frame hinzu"""
    nozzle_temp = 200 + random.randint(-5, 5)
    bed_temp = 60 + random.randint(-2, 2)
    progress = (datetime.now().minute % 100)
    time_left = 90 - int((progress / 100) * 90)
    
    # Header
    cv2.putText(frame,
                f"{'Bambulab X1C' if is_bambulab else 'Standard Printer'} #{printer_number}",
                (50, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 0) if is_bambulab else (255, 255, 255),
                2)
    
    if is_bambulab:
        # Temperaturen            
        cv2.putText(frame,
                    f"Nozzle: {nozzle_temp}°C",
                    (50, 100),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 128, 0),
                    2)
                    
        cv2.putText(frame,
                    f"Bed: {bed_temp}°C",
                    (50, 130),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 128, 0),
                    2)
        
        # Fortschritt
        cv2.putText(frame,
                    f"Progress: {progress}% - Time left: {time_left}min",
                    (50, 160),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2)
    
    # Timestamp
    cv2.putText(frame,
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                (50, 440),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (128, 128, 128),
                2)
    
    return frame

def generate_3d_print_simulation(printer_number):
    """Drucker 1: 3D-Druck Simulation"""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Simuliere bewegenden Druckkopf
    t = time.time()
    x = int(320 + np.sin(t) * 200)
    y = int(240 + np.cos(t * 2) * 100)
    
    # Zeichne "Druckkopf"
    cv2.circle(frame, (x, y), 5, (0, 255, 0), -1)
    
    # Zeichne "gedruckte Schichten"
    for i in range(0, 360, 10):
        x1 = int(320 + np.cos(np.radians(i)) * 100)
        y1 = int(240 + np.sin(np.radians(i)) * 100)
        x2 = int(320 + np.cos(np.radians(i+10)) * 100)
        y2 = int(240 + np.sin(np.radians(i+10)) * 100)
        cv2.line(frame, (x1, y1), (x2, y2), (0, 128, 255), 2)
    
    return generate_printer_info(frame, printer_number)

def generate_test_pattern(printer_number):
    """Drucker 2: Testmuster"""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Farbbalken
    colors = [
        (255, 0, 0),   # Rot
        (0, 255, 0),   # Grün
        (0, 0, 255),   # Blau
        (255, 255, 0), # Gelb
        (255, 0, 255), # Magenta
        (0, 255, 255), # Cyan
        (255, 255, 255)# Weiß
    ]
    
    bar_width = 640 // len(colors)
    for i, color in enumerate(colors):
        x1 = i * bar_width
        x2 = (i + 1) * bar_width
        cv2.rectangle(frame, (x1, 100), (x2, 380), color, -1)
    
    # Bewegtes Element
    t = time.time()
    y = int(240 + np.sin(t) * 100)
    cv2.line(frame, (0, y), (640, y), (255, 255, 255), 2)
    
    return generate_printer_info(frame, printer_number)

def generate_moving_cube(printer_number):
    """Drucker 3: 3D Würfel Animation"""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    t = time.time()
    center_x, center_y = 320, 240
    size = 100
    
    # Würfel-Punkte
    points = np.array([
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
    ]) * size
    
    # Rotation
    angle = t
    rot_x = np.array([
        [1, 0, 0],
        [0, np.cos(angle), -np.sin(angle)],
        [0, np.sin(angle), np.cos(angle)]
    ])
    rot_y = np.array([
        [np.cos(angle), 0, np.sin(angle)],
        [0, 1, 0],
        [-np.sin(angle), 0, np.cos(angle)]
    ])
    
    # Punkte transformieren
    points = points @ rot_x @ rot_y
    
    # 2D-Projektion
    points_2d = points[:, :2] + np.array([center_x, center_y])
    points_2d = points_2d.astype(int)
    
    # Würfel zeichnen
    for i in range(4):
        cv2.line(frame, tuple(points_2d[i]), tuple(points_2d[(i+1)%4]), (0, 255, 0), 2)
        cv2.line(frame, tuple(points_2d[i+4]), tuple(points_2d[((i+1)%4)+4]), (0, 255, 0), 2)
        cv2.line(frame, tuple(points_2d[i]), tuple(points_2d[i+4]), (0, 255, 0), 2)
    
    return generate_printer_info(frame, printer_number)

def generate_normal_frame(printer_number):
    """Drucker 4: Standard Kamera mit Gitter"""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Gitter zeichnen
    for x in range(0, 640, 40):
        cv2.line(frame, (x, 0), (x, 480), (64, 64, 64), 1)
    for y in range(0, 480, 40):
        cv2.line(frame, (0, y), (640, y), (64, 64, 64), 1)
    
    # Bewegte Elemente
    t = time.time()
    for i in range(5):
        y = int(240 + np.sin(t + i) * 100)
        cv2.line(frame, (0, y), (640, y), (0, 255, 0), 1)
    
    return generate_printer_info(frame, printer_number, is_bambulab=False)

def start_rtsp_stream(printer_number):
    bind_ip = '0.0.0.0'
    is_normal = printer_number == 4
    port = "554" if is_normal else "322"
    access_code = "12345678"  # Standard Access Code
    
    # Stream-URL im korrekten Format
    stream_path = "stream1" if is_normal else "streaming/live/1"
    stream_url = f"rtsp://{bind_ip}:{port}/{stream_path}"  # Intern immer rtsp://
    
    print(f"Starting {'Normal' if is_normal else 'Bambulab'} stream {printer_number} on {stream_url}")
    
    command = [
        'ffmpeg',
        '-f', 'rawvideo',
        '-pixel_format', 'bgr24',
        '-video_size', '640x480',
        '-framerate', '30',
        '-i', '-',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p',
        '-f', 'rtsp',
        '-rtsp_transport', 'tcp',
        stream_url
    ]
    
    try:
        # Öffne Log-Datei
        log_file = open(f'ffmpeg_log_{printer_number}.txt', 'w')
        
        process = subprocess.Popen(command, 
                                 stdin=subprocess.PIPE,
                                 stdout=log_file,
                                 stderr=log_file,
                                 bufsize=0)
        
        # Warte kurz bis FFmpeg bereit ist
        time.sleep(2)
        
        while True:
            try:
                if printer_number == 1:
                    frame = generate_3d_print_simulation(printer_number)
                elif printer_number == 2:
                    frame = generate_test_pattern(printer_number)
                elif printer_number == 3:
                    frame = generate_moving_cube(printer_number)
                else:
                    frame = generate_normal_frame(printer_number)
                
                process.stdin.write(frame.tobytes())
                process.stdin.flush()
                
                if process.poll() is not None:
                    print(f"FFmpeg process {printer_number} died!")
                    break
                    
                time.sleep(1/30)
                
            except IOError as e:
                print(f"IOError in stream {printer_number}: {e}")
                break
            except Exception as e:
                print(f"Error in stream {printer_number}: {e}")
                break
                
    except Exception as e:
        print(f"Failed to start stream {printer_number}: {e}")
    finally:
        if 'process' in locals():
            process.terminate()
            print(f"Terminated stream {printer_number}")
        if 'log_file' in locals():
            log_file.close()

def start_ssdp_service():
    """Startet den SSDP-Service für Drucker-Discovery"""
    SSDP_ADDR = '239.255.255.250'
    SSDP_PORT = 1900
    
    # Hole die IP des Containers
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't need to be reachable
        s.connect(('10.255.255.255', 1))
        container_ip = s.getsockname()[0]
    except Exception:
        container_ip = '127.0.0.1'
    finally:
        s.close()
    
    def create_ssdp_response(printer_number, is_normal=False):
        model = "Standard Printer" if is_normal else "Bambulab X1C"
        return f"""NOTIFY * HTTP/1.1\r
HOST: 239.255.255.250:1900\r
CACHE-CONTROL: max-age=1800\r
LOCATION: http://{container_ip}:8883\r
NT: urn:schemas-upnp-org:device:Printer:1\r
NTS: ssdp:alive\r
SERVER: Bambu Lab Printer/1.0\r
USN: uuid:Mock-Printer-{printer_number}::urn:schemas-upnp-org:device:Printer:1\r
MODEL: {model}\r
SERIAL: MOCK{printer_number:03d}\r
\r\n"""

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    # Erlaube Multicast
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
    
    try:
        while True:
            # Sende SSDP Announcements für alle Drucker
            for i in range(1, 5):
                is_normal = (i == 4)
                msg = create_ssdp_response(i, is_normal)
                sock.sendto(msg.encode(), (SSDP_ADDR, SSDP_PORT))
            time.sleep(5)  # Alle 5 Sekunden wiederholen
            
    except Exception as e:
        print(f"SSDP Service error: {e}")
    finally:
        sock.close()

def start_printer_ports():
    """Startet die typischen Drucker-Ports (8883, 9100)"""
    for port in [8883, 9100]:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(('0.0.0.0', port))
            sock.listen(1)
            print(f"Listening on port {port}")
        except Exception as e:
            print(f"Could not bind to port {port}: {e}")

def start_discovery_service():
    """Startet den Discovery-Service für Bambulab-Drucker"""
    DISCOVERY_PORT = 8991  # Standard Bambulab Discovery Port
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(('0.0.0.0', DISCOVERY_PORT))
    
    print(f"Discovery service listening on port {DISCOVERY_PORT}")
    
    try:
        while True:
            data, addr = sock.recvfrom(1024)
            try:
                request = json.loads(data.decode())
                if request.get("command") == "get_version":
                    # Sende Antwort für jeden Mock-Drucker
                    for i in range(1, 5):
                        is_normal = (i == 4)
                        if not is_normal:  # Nur Bambulab-Drucker antworten
                            response = {
                                "dev_id": f"mock_printer_{i}",
                                "dev_name": f"Mock Printer {i}",
                                "dev_sn": f"MOCK{i:03d}",
                                "dev_type": "X1C",
                                "version": "1.0.0"
                            }
                            sock.sendto(json.dumps(response).encode(), addr)
                            print(f"Sent discovery response for printer {i} to {addr}")
            except json.JSONDecodeError:
                continue
            
    except Exception as e:
        print(f"Discovery service error: {e}")
    finally:
        sock.close()

def start_all_printers():
    threads = []
    try:
        # Starte SSDP-Service
        ssdp_thread = Thread(target=start_ssdp_service)
        ssdp_thread.daemon = True
        ssdp_thread.start()
        threads.append(ssdp_thread)
        
        # Starte Printer-Ports
        port_thread = Thread(target=start_printer_ports)
        port_thread.daemon = True
        port_thread.start()
        threads.append(port_thread)
        
        # Starte Discovery-Service
        discovery_thread = Thread(target=start_discovery_service)
        discovery_thread.daemon = True
        discovery_thread.start()
        threads.append(discovery_thread)
        
        # Starte die 4 Printer-Streams
        for i in range(1, 5):
            print(f"Starting {'Normal' if i == 4 else 'Bambulab'} Printer {i}")
            thread = Thread(target=start_rtsp_stream, args=(i,))
            thread.daemon = True
            threads.append(thread)
            thread.start()
        
        while True:
            time.sleep(1)
            if not all(t.is_alive() for t in threads):
                print("Ein Service ist abgestürzt, starte neu...")
                return
                
    except KeyboardInterrupt:
        print("\nShutting down services...")
    except Exception as e:
        print(f"Error in main thread: {e}")

if __name__ == '__main__':
    while True:
        start_all_printers()
        print("Restarting all streams...")
        time.sleep(5)  # Warte kurz vor Neustart 