const isDev = process.env.NODE_ENV === 'development';
const backendPort = 4000;

// Dynamische Backend-URL basierend auf dem Host, von dem die Seite aufgerufen wird
export const API_URL = `http://${window.location.hostname}:${backendPort}`;
export const API_HOST = window.location.hostname; 