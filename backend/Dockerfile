FROM node:18-alpine

# FFmpeg mit SSL Support installieren
RUN apk add --no-cache ffmpeg openssl

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Ports für RTSP und WebSocket
EXPOSE 4000
EXPOSE 322
EXPOSE 9100-9200

CMD ["npm", "start"] 