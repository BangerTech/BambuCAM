FROM node:16-alpine

WORKDIR /app

# Dependencies installieren
COPY package*.json ./
RUN npm install

# Anwendungscode kopieren
COPY . .

# Build für Produktion
RUN npm run build

# Serve mit einem leichten Webserver
RUN npm install -g serve

# Warte auf Build-Verzeichnis und starte Server
CMD sh -c 'while [ ! -d "build" ]; do sleep 1; done && serve -s build -l 3000' 