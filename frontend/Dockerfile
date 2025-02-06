FROM node:16-alpine

WORKDIR /app

# Install wget
RUN apk add --no-cache wget

# Kopiere package.json und package-lock.json
COPY package*.json ./

# Installiere Abhängigkeiten und react-scripts global
RUN npm install -g react-scripts && npm install

# Kopiere den Rest des Codes
COPY . .

# Download assets
RUN mkdir -p src/assets && \
    wget https://cdn-icons-png.flaticon.com/64/5038/5038961.png -O src/assets/printer-icon.png && \
    wget https://cdn.freesound.org/previews/320/320181_5260872-lq.mp3 -O src/assets/notification.mp3

# Setze Umgebungsvariablen
ENV NODE_ENV=development
ENV REACT_APP_API_URL=http://backend:4000

# Exponiere Port 3000
EXPOSE 3000

# Starte die Entwicklungsumgebung
CMD ["npm", "start"] 