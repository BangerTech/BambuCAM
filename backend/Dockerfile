FROM node:18-alpine

# FFmpeg mit SSL Support
RUN apk add --no-cache ffmpeg openssl curl

WORKDIR /app

# Erst package.json kopieren und installieren
COPY package*.json ./
RUN npm install --production

# Dann erst den Rest kopieren
COPY . .

# Ports
EXPOSE 4000 322 9100-9200

CMD ["node", "src/index.js"]  # Direkter Start statt npm 