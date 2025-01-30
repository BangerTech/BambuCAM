FROM node:18-alpine

# Installiere notwendige Tools
RUN apk add --no-cache ffmpeg wget

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Setze Umgebungsvariablen
ENV NODE_ENV=development

EXPOSE 4000

# Warte auf Port-Verfügbarkeit und starte dann den Server
CMD ["npm", "start"] 