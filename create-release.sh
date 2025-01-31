#!/bin/bash

# Erstelle temporäres Verzeichnis
temp_dir="BambuCAM-release"
mkdir -p "$temp_dir"

# Kopiere notwendige Dateien und Ordner
cp -r backend "$temp_dir/"
cp -r frontend "$temp_dir/"
cp docker-compose.yml "$temp_dir/"
cp install-and-run.ps1 "$temp_dir/"
cp start.bat "$temp_dir/"
cp README.md "$temp_dir/"

# Entferne node_modules und andere nicht benötigte Verzeichnisse
rm -rf "$temp_dir"/backend/node_modules
rm -rf "$temp_dir"/frontend/node_modules
rm -rf "$temp_dir"/backend/.git
rm -rf "$temp_dir"/frontend/.git

# Erstelle ZIP-Archiv
zip -r BambuCAM.zip "$temp_dir"

# Lösche temporäres Verzeichnis
rm -rf "$temp_dir"

echo "Release ZIP wurde erstellt: BambuCAM.zip" 