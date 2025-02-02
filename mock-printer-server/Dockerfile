FROM python:3.9-slim

# System-Pakete für OpenCV
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python-Abhängigkeiten
COPY requirements.txt .
RUN pip install -r requirements.txt

# App-Code kopieren
COPY . .

CMD ["python", "mock_printer.py"] 