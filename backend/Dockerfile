FROM python:3.11-slim

# Installiere FFmpeg und andere Abhängigkeiten
RUN apt-get update && apt-get install -y \
    ffmpeg \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Setze Arbeitsverzeichnis
WORKDIR /app

# Kopiere requirements.txt
COPY requirements.txt .

# Installiere Python-Abhängigkeiten
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --upgrade pip

# Kopiere den Rest der Anwendung
COPY . .

# Erstelle notwendige Verzeichnisse und setze Berechtigungen
RUN mkdir -p /app/data/printers /app/data/streams /app/logs \
    && chmod -R 777 /app/data /app/logs \
    && mkdir -p /app/data/go2rtc \
    && chmod -R 777 /app/data/go2rtc

ENV FLASK_APP=src.app
ENV PYTHONPATH=/app

CMD ["flask", "run", "--host=0.0.0.0", "--port=4000"] 