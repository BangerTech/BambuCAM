#!/bin/bash

# Prüfe ob Version als Parameter übergeben wurde
if [ -z "$1" ]; then
    echo "Bitte Version angeben (z.B. ./create-release.sh 1.0.0)"
    exit 1
fi

VERSION=$1

# Aktualisiere Version in package.json
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" frontend/package.json
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" backend/package.json

# Aktualisiere Docker Image Tags
sed -i "s/bambucam-frontend:.*/bambucam-frontend:$VERSION/" docker-compose.yml
sed -i "s/bambucam-backend:.*/bambucam-backend:$VERSION/" docker-compose.yml

# Erstelle Git Tag und Push
git add .
git commit -m "Release v$VERSION"
git tag -a "v$VERSION" -m "Version $VERSION"
git push origin main
git push origin "v$VERSION"

echo "Release v$VERSION wurde erstellt und gepusht"

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