FROM node:16-alpine

WORKDIR /app

# Kopiere package.json und package-lock.json
COPY package*.json ./

# Installiere Abhängigkeiten und react-scripts global
RUN npm install -g react-scripts && npm install

# Kopiere den Rest des Codes (inkl. Assets)
COPY . .

# Setze Umgebungsvariablen
ENV NODE_ENV=development
ENV REACT_APP_API_URL=http://backend:4000

# Exponiere Port 3000
EXPOSE 3000

# Starte die Entwicklungsumgebung
CMD ["npm", "start"] 