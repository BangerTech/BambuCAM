# BambuCAM

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<div align="center">
  <img src="assets/logo.png" alt="BambuCAM Logo" width="400"/>
</div>

> 🎥 Eine moderne Webanwendung zur Überwachung mehrerer BambuLab X1C 3D-Drucker über deren Kamera-Feeds

## Screenshots

<img src="assets/dashboard-empty.png" width="32%" /> <img src="assets/add-printer.png" width="32%" /> <img src="assets/dashboard-printers.png" width="32%" />

_Von links nach rechts: Startseite, Drucker hinzufügen, Überwachungsansicht mit mehreren Druckern_

## Table of Contents
- [Was ist BambuCAM?](#was-ist-bambucam)
- [Features](#features)
- [Installation](#installation)
- [Voraussetzungen](#voraussetzungen)
- [Fehlerbehebung](#fehlerbehebung)
- [Support](#support)

## Was ist BambuCAM?
BambuCAM ist eine benutzerfreundliche Webanwendung zur gleichzeitigen Überwachung mehrerer BambuLab X1C 3D-Drucker. Die App ermöglicht es, alle Drucker-Kameras in einer übersichtlichen Oberfläche zu organisieren und zu monitoren.

### Features
- 🎥 Live-Kamera-Feeds von mehreren Druckern
- 🖱️ Drag & Drop Interface zur Anordnung der Kameras
- 🖥️ Vollbild-Modus für jeden Drucker
- ➕ Einfaches Hinzufügen und Entfernen von Druckern
- 🔄 Automatische RTSP-Verbindung
- 📱 Responsive Design für mobile Geräte

## Installation

### Für Windows-Benutzer
1. [Docker Desktop für Windows](https://www.docker.com/products/docker-desktop/) installieren
2. Die neueste Version von [BambuCAM](https://github.com/IHR_USERNAME/BambuCAM/releases) herunterladen
3. ZIP-Datei an einen beliebigen Ort entpacken
4. `start.bat` per Rechtsklick als Administrator ausführen
5. Im Browser öffnen:
   - http://localhost:3000
   - oder http://IHRE-IP-ADRESSE:3000

### Für Linux-Benutzer

#### Quick Start Installation
1. Repository klonen:
```bash
git clone https://github.com/IHR_USERNAME/BambuCAM.git
cd BambuCAM
```

2. Docker Compose starten:
```bash
docker-compose up -d
```

3. Im Browser öffnen:
```bash
http://localhost:3000
```

## Drucker Einrichtung

### Voraussetzungen
- BambuLab X1C Drucker im gleichen Netzwerk
- Aktivierter "LAN Only Mode" auf den Druckern
- Aktivierte Kamera in den Druckereinstellungen

### Drucker hinzufügen
1. In der App auf "Drucker hinzufügen" klicken
2. Namen für den Drucker eingeben (z.B. "X1C Werkstatt")
3. IP-Adresse des Druckers eingeben (z.B. "192.168.1.100")
4. Access Code eingeben (zu finden in den Druckereinstellungen unter "Netzwerk")
5. Auf "Hinzufügen" klicken

## Technologien
- React.js Frontend
- Node.js Backend
- Docker & Docker Compose
- RTSP Stream Verarbeitung
- WebSocket Verbindung

## Fehlerbehebung

Falls keine Verbindung zum Drucker möglich ist:
1. Prüfen Sie, ob der Drucker eingeschaltet und mit dem Netzwerk verbunden ist
2. Prüfen Sie, ob Sie die korrekte IP-Adresse verwenden
3. Prüfen Sie, ob der Access Code korrekt ist
4. Prüfen Sie, ob "LAN Only Mode" aktiviert ist
5. Starten Sie den Drucker neu

## Support

Bei Problemen oder Fragen erstellen Sie bitte ein [GitHub Issue](https://github.com/IHR_USERNAME/BambuCAM/issues).

## Keywords
`bambulab`