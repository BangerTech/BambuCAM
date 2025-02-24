#!/bin/sh

# Setze Berechtigungen für go2rtc Verzeichnis
chmod -R 777 /app/data/go2rtc

# Starte Flask
exec flask run --host=0.0.0.0 --port=4000 