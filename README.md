<div align="center">
  <img src="assets/logo.png" alt="BambuLab Cameras Logo" width="400"/>
</div>

Eine Webanwendung zur Überwachung mehrerer BambuLab X1C 3D-Drucker über deren Kamera-Feeds.

![BambuLab Cameras Screenshot](screenshot.png)

## Features

- Live-Kamera-Feeds von mehreren BambuLab X1C Druckern
- Drag & Drop Interface zur Anordnung der Kameras
- Vollbild-Modus für jeden Drucker
- Einfaches Hinzufügen und Entfernen von Druckern
- Automatische Verbindung über RTSP

## Installation

### Für Windows-Benutzer
1. [Docker Desktop für Windows](https://www.docker.com/products/docker-desktop/) installieren
2. Die neueste Version von [BambuLab Cameras](https://github.com/IHR_USERNAME/BambuLab-Cameras/releases) herunterladen
3. ZIP-Datei an einen beliebigen Ort entpacken
4. `start.bat` per Rechtsklick als Administrator ausführen
5. Die App öffnet sich automatisch im Browser unter:
   - http://localhost:3000
   - oder http://IHRE-IP-ADRESSE:3000

### Drucker einrichten

1. Im Drucker "LAN Only Mode" aktivieren:
   - Druckereinstellungen → Netzwerk → LAN Only Mode
2. Kamera in den Einstellungen aktivieren
3. Drucker neu starten
4. Access Code notieren (zu finden in den Druckereinstellungen unter "Netzwerk")

### Drucker hinzufügen

1. In der App auf "Drucker hinzufügen" klicken
2. Namen für den Drucker eingeben (z.B. "X1C Werkstatt")
3. IP-Adresse des Druckers eingeben (z.B. "192.168.1.100")
4. Access Code eingeben
5. Auf "Hinzufügen" klicken

## Voraussetzungen

- Windows 10/11
- Docker Desktop
- BambuLab X1C Drucker im gleichen Netzwerk
- Aktivierter "LAN Only Mode" auf den Druckern
- Aktivierte Kamera in den Druckereinstellungen

## Fehlerbehebung

Falls keine Verbindung zum Drucker möglich ist:
1. Prüfen Sie, ob der Drucker eingeschaltet und mit dem Netzwerk verbunden ist
2. Prüfen Sie, ob Sie die korrekte IP-Adresse verwenden
3. Prüfen Sie, ob der Access Code korrekt ist
4. Prüfen Sie, ob "LAN Only Mode" aktiviert ist
5. Starten Sie den Drucker neu

## Support

Bei Problemen oder Fragen erstellen Sie bitte ein [GitHub Issue](https://github.com/IHR_USERNAME/BambuLab-Cameras/issues).

## Lizenz

[MIT](LICENSE) 