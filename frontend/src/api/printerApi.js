import logger from '../utils/logger';
import { API_URL } from '../config';

export const printerApi = {
  // Hole Status eines Druckers
  fetchStatus: async (printerId) => {
    try {
      const response = await fetch(`${API_URL}/printers/${printerId}/status`);
      const data = await response.json();
      logger.api('Received printer status:', {
        printerId,
        status: data.status,
        temps: data.temperatures,
        state: data.state
      });
      return data;
    } catch (error) {
      logger.error('Error fetching printer status:', error);
      throw error;
    }
  },

  // Drucker hinzufügen
  addPrinter: async (printerData) => {
    try {
      const response = await fetch(`${API_URL}/printers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printerData)
      });
      const data = await response.json();
      logger.api('Added printer:', data);
      return data;
    } catch (error) {
      logger.error('Error adding printer:', error);
      throw error;
    }
  },

  // Drucker löschen
  deletePrinter: async (printerId) => {
    try {
      const response = await fetch(`${API_URL}/printers/${printerId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      logger.api('Deleted printer:', { printerId, response: data });
      return data;
    } catch (error) {
      logger.error('Error deleting printer:', error);
      throw error;
    }
  }
}; 