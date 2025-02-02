import cv2
import time
import numpy as np
from datetime import datetime
import os
import threading
import random

def generate_bambulab_frame(printer_number):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Simuliere verschiedene Temperaturen und Fortschritte
    nozzle_temp = 200 + random.randint(-5, 5)
    bed_temp = 60 + random.randint(-2, 2)
    progress = (datetime.now().minute % 100)  # Progress 0-99%
    time_left = 90 - int((progress / 100) * 90)  # 90min -> 0min
    
    # Drucker-Status
    cv2.putText(frame,
                f"Bambulab X1C #{printer_number}",
                (50, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 0),
                2)
    
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
    
    # Zeit und Fortschritt
    cv2.putText(frame,
                f"Progress: {progress}% - Time left: {time_left}min",
                (50, 160),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2)
                
    # Aktuelle Zeit
    cv2.putText(frame,
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                (50, 440),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (128, 128, 128),
                2)
                
    return frame

def generate_normal_frame(printer_number):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Einfacher Webcam-Style Stream
    cv2.putText(frame,
                f"Standard Printer Camera #{printer_number}",
                (50, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (255, 255, 255),
                2)
    
    # Timestamp
    cv2.putText(frame,
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                (50, 440),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2)
    
    # Simuliere Bewegung durch sich ändernde Linien
    t = time.time()
    for i in range(5):
        y = int(240 + np.sin(t + i) * 100)
        cv2.line(frame, (0, y), (640, y), (0, 255, 0), 1)
                
    return frame

def start_rtsp_stream(printer_number):
    host_ip = os.getenv('HOST_IP', '0.0.0.0')
    rtsp_url = f'rtsp://{host_ip}:855{printer_number}/stream1'
    
    print(f"Starting {'Normal' if printer_number == 4 else 'Bambulab'} Printer {printer_number} at {rtsp_url}")
    
    server = cv2.VideoWriter_fourcc(*'XVID')
    out = cv2.VideoWriter(rtsp_url,
                         server,
                         30.0, 
                         (640,480))
    
    while True:
        # Printer 4 ist der "normale" Drucker
        if printer_number == 4:
            frame = generate_normal_frame(printer_number)
        else:
            frame = generate_bambulab_frame(printer_number)
        out.write(frame)
        time.sleep(1/30)  # 30 FPS

def start_all_printers():
    # Starte 4 Printer (3 Bambulab, 1 Normal)
    for i in range(1, 5):
        thread = threading.Thread(target=start_rtsp_stream, args=(i,))
        thread.daemon = True
        thread.start()
        print(f"Started {'Normal' if i == 4 else 'Bambulab'} Printer {i}")
    
    # Hauptthread am Leben halten
    while True:
        time.sleep(1)

if __name__ == '__main__':
    start_all_printers() 