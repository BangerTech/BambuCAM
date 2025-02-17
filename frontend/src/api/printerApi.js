import logger from '../utils/logger';
import { API_URL } from '../config';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export const printerApi = {
  // Hole Status eines Druckers
  fetchStatus: async (printerId) => {
    try {
      const response = await fetch(`${API_URL}/printers/${printerId}/status`);
      const data = await response.json();
      
      // Normalisiere die Temperaturdaten
      if (data.temperatures && !data.temps) {
        data.temps = data.temperatures;  // Kopiere temperatures nach temps
      }
      
      // Debug-Log für die API-Response
      logger.apiResponse(`/printers/${printerId}/status`, data);
      
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