#!/bin/bash

# Erstelle temporäres Verzeichnis
TEMP_DIR="BambuCAM-Release"
mkdir -p "$TEMP_DIR"

# Kopiere notwendige Dateien
cp README.md start.bat docker-compose.yml "$TEMP_DIR/"

# Frontend Dateien
mkdir -p "$TEMP_DIR/frontend"
cp frontend/Dockerfile frontend/nginx.conf frontend/package.json "$TEMP_DIR/frontend/"
cp -r frontend/src frontend/public "$TEMP_DIR/frontend/"

# Backend Dateien
mkdir -p "$TEMP_DIR/backend"
cp backend/Dockerfile backend/package.json backend/server.js "$TEMP_DIR/backend/"

# Assets Ordner für Logo und Screenshots
mkdir -p "$TEMP_DIR/assets"
cp -r assets/* "$TEMP_DIR/assets/"

# Erstelle ZIP
cd "$TEMP_DIR" && zip -r ../BambuCAM.zip * && cd ..

# Lösche temporäres Verzeichnis
rm -rf "$TEMP_DIR"

echo "Release ZIP wurde erstellt: BambuCAM.zip" 