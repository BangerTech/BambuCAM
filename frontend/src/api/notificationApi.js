import logger from '../utils/logger';
import { API_URL } from '../config';

export const notificationApi = {
  getStatus: async () => {
    try {
      const response = await fetch(`${API_URL}/notifications/status`);
      const data = await response.json();
      logger.notification('Notification status:', data);
      return data;
    } catch (error) {
      logger.error('Error fetching notification status:', error);
      throw error;
    }
  },
  
  updateSettings: async (settings) => {
    try {
      const response = await fetch(`${API_URL}/notifications/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await response.json();
      logger.notification('Updated notification settings:', data);
      return data;
    } catch (error) {
      logger.error('Error updating notification settings:', error);
      throw error;
    }
  }
}; 