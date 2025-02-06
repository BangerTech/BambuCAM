# BambuCAM

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<div align="center">
  <img src="assets/logo.png" alt="BambuCAM Logo" width="400"/>
</div>

> 🎥 A modern web application for monitoring multiple BambuLab X1C 3D printers through their camera feeds

## Screenshots

<img src="assets/dashboard-empty.png" width="32%" /> <img src="assets/add-printer.png" width="32%" /> <img src="assets/dashboard-printers.png" width="32%" />

_Left to right: Home screen, Add printer, Monitoring view with multiple printers_

## Table of Contents
- [What is BambuCAM?](#what-is-bambucam)
- [Features](#features)
- [Installation](#installation)
- [Requirements](#requirements)
- [Troubleshooting](#troubleshooting)
- [Support](#support)

## What is BambuCAM?
BambuCAM is a user-friendly web application for simultaneously monitoring multiple BambuLab X1C 3D printers. The app allows you to organize and monitor all printer cameras in a clean interface.

### Features
- 🎥 Live camera feeds from multiple printers
- 🖱️ Drag & drop interface for camera arrangement
- 🖥️ Fullscreen mode for each printer
- ➕ Easy adding and removing of printers
- 🔄 Automatic RTSP connection
- 📱 Responsive design for mobile devices

## Installation

### Windows Users

#### 🚀 Quick Start

1. Download the latest version of BambuCAM
2. Extract the ZIP file
3. Right-click `install-and-run.ps1` and select "Run with PowerShell"
4. Follow the on-screen instructions

The installer will automatically:
- Install required programs (Docker, Git) if not present
- Install BambuCAM
- Create a desktop shortcut
- Start the application

#### 📋 System Requirements

- Windows 10/11
- 4 GB RAM
- 2 GB free disk space
- Internet connection

#### 🔄 Starting the Application

After installation, you can start BambuCAM in two ways:
1. Via the "BambuCAM" desktop shortcut
2. By running `start.bat`

The application will be available at http://localhost:3000

#### ❓ Troubleshooting

If you encounter issues:
1. Make sure Docker Desktop is running
2. Check if port 3000 is not in use by another application
3. Open an issue on GitHub

#### 🔧 Uninstallation

1. Run `docker-compose down` in the installation directory
2. Delete the folder `%LOCALAPPDATA%\BambuCAM`
3. Remove the desktop shortcut

### Linux Users

#### Quick Start Installation
1. Clone repository:
```bash
git clone https://github.com/BangerTech/BambuCAM.git
cd BambuCAM
```

2. Start Docker Compose:
```bash
docker-compose up -d
```

3. Open in browser:
```bash
http://localhost:3000
```

## Printer Setup

### Requirements
- BambuLab X1C printer on the same network
- "LAN Only Mode" enabled on the printers
- Camera enabled in printer settings

### Adding a Printer
1. Click "Add Printer" in the app
2. Enter a name for the printer (e.g., "X1C Workshop")
3. Enter the printer's IP address (e.g., "192.168.1.100")
4. Enter Access Code (found in printer settings under "Network")
5. Click "Add"

## Technologies
- React.js Frontend
- Node.js Backend
- Docker & Docker Compose
- RTSP Stream Processing
- WebSocket Connection

## Troubleshooting

If you cannot connect to the printer:
1. Check if the printer is powered on and connected to the network
2. Verify you are using the correct IP address
3. Verify the Access Code is correct
4. Check if "LAN Only Mode" is enabled
5. Restart the printer

## Support

For issues or questions, please create a [GitHub Issue](https://github.com/BangerTech/BambuCAM/issues).

## Sponsorship

## Sponsorship

<a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=FD26FHKRWS3US" target="_blank"><img src="https://pics.paypal.com/00/s/N2EwMzk4NzUtOTQ4Yy00Yjc4LWIwYmUtMTA3MWExNWIzYzMz/file.PNG" alt="SUPPORT" height="51"></a>

## Keywords
`bambulab` `3d-printer` `camera-viewer` `monitoring` `docker` `react` `rtsp-stream` 
`printer-management` `web-interface` `live-stream` `temperature-monitoring` 
`print-progress` `open-source`

## Configuration

## 🐳 Docker Installation

1. Lade die `docker-compose.yml` herunter:
```bash
wget https://github.com/BangerTech/BambuCAM/releases/latest/download/BambuCAM-docker.zip
unzip BambuCAM-docker.zip
```

2. Starte BambuCAM:
```bash
docker compose up -d
```

Die App ist dann unter http://localhost:3000 erreichbar.