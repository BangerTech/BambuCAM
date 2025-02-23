FROM python:3.11-slim

WORKDIR /app

# System-Abhängigkeiten
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ffmpeg \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Python-Abhängigkeiten
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Anwendungscode kopieren
COPY . .

# Berechtigungen für Daten- und Log-Verzeichnisse
RUN mkdir -p /app/data/printers /app/data/streams /app/logs \
    && chmod -R 777 /app/data /app/logs \
    && mkdir -p /app/data/go2rtc \
    && echo 'streams:\n\napi:\n  listen: ":1984"\n  base_path: "/api"\n\nwebrtc:\n  listen: ":8555"' > /app/data/go2rtc/go2rtc.yaml \
    && chmod -R 777 /app/data/go2rtc

ENV FLASK_APP=src.app
ENV PYTHONPATH=/app

CMD ["flask", "run", "--host=0.0.0.0", "--port=4000"] 