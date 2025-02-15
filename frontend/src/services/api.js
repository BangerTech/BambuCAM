import { API_URL } from '../config';

export const api = {
    async getPrinters() {
        const response = await fetch(`${API_URL}/printers`);
        if (!response.ok) throw new Error('Failed to fetch printers');
        return response.json();
    },

    async getCloudPrinters(token) {
        const response = await fetch(`${API_URL}/cloud/printers`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch cloud printers');
        return response.json();
    },

    // ... weitere API-Methoden
}; 