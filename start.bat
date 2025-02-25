@echo off
cls
echo ╔══════════════════════════════════════════╗
echo ║            BambuCAM Starter              ║
echo ╚══════════════════════════════════════════╝
echo.

REM Prüfe ob Docker läuft
docker info > nul 2>&1
if errorlevel 1 (
    echo [31m⚠️ Docker ist nicht gestartet![0m
    echo [33mStarte Docker Desktop...[0m
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Warte auf Docker Start...
    timeout /t 20 /nobreak > nul
)

echo [36m🚀 Starte BambuCAM...[0m
cd /d "%~dp0"
docker-compose up -d

echo.
echo [32m✅ BambuCAM wurde gestartet![0m
echo [36m🌐 Öffne http://localhost:3000 im Browser...[0m
start http://localhost:3000

timeout /t 5 /nobreak > nul 