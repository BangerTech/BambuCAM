const isDev = process.env.NODE_ENV === 'development';
const hostname = window.location.hostname;

export const config = {
    // Wir nutzen die Nginx-Proxy-URL (Port 80)
    API_URL: `http://${hostname}/api`,  // Kein Port nötig, da Nginx auf 80 läuft
    WS_URL: `ws://${hostname}/stream`,
    API_HOST: hostname,
    
    // Weitere Konfigurationen
    NOTIFICATION_REFRESH_INTERVAL: 30000, // 30 Sekunden
    PRINTER_REFRESH_INTERVAL: 5000,       // 5 Sekunden
    MAX_RETRIES: 3
};

export const { API_URL, WS_URL, API_HOST } = config; 