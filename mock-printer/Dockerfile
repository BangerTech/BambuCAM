FROM ubuntu:latest

# Verhindere Interaktive Prompts während der Installation
ENV DEBIAN_FRONTEND=noninteractive

# Installiere gstreamer und andere benötigte Pakete
RUN apt-get update && apt-get install -y \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-rtsp \
    gstreamer1.0-libav \
    libgstrtspserver-1.0-0 \
    gstreamer1.0-rtsp \
    && rm -rf /var/lib/apt/lists/*

# Kopiere das Start-Skript
COPY start.sh /start.sh

# Setze Berechtigungen für das Start-Skript
RUN chmod +x /start.sh

# Exponiere die RTSP-Ports
EXPOSE 8554 8555 8556

# Starte die RTSP-Server
CMD ["/start.sh"] 