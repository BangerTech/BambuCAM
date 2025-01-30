FROM node:18-alpine

# FFmpeg installieren
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Verzeichnisstruktur erstellen
RUN mkdir -p src/services src/routes

# Erst package.json kopieren und installieren
COPY package*.json ./
RUN npm install

# Dann Rest kopieren
COPY . .

EXPOSE 4000

CMD ["npm", "start"] 