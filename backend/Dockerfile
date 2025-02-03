FROM python:3.10-slim

# System-Pakete installieren
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    build-essential \
    cmake \
    pkg-config \
    gfortran \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pip upgraden und Requirements installieren
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 4000

CMD ["python", "app.py"] 