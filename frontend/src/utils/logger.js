const LOG_LEVEL = process.env.REACT_APP_LOG_LEVEL || 'debug';

const logger = {
  lastNotificationStatus: null,
  
  debug: (...args) => {
    if (LOG_LEVEL === 'debug') {
      console.debug('[DEBUG]', new Date().toISOString(), ...args);
    }
  },
  
  info: (...args) => {
    console.info('[Info]', new Date().toISOString(), ...args);
  },
  
  error: (...args) => {
    console.error('[ERROR]', new Date().toISOString(), ...args);
  },
  
  api: (...args) => {
    if (LOG_LEVEL === 'debug') {
      console.info('[API]', new Date().toISOString(), ...args);
    }
  },
  
  printer: (...args) => {
    if (LOG_LEVEL === 'debug') {
      console.info('[Printer]', new Date().toISOString(), ...args);
    }
  },
  
  notification: (message, data = null) => {
    // Für Status-Checks
    if (message.includes('Checking notification status')) {
      // Nur loggen wenn sich der Status geändert hat
      const statusStr = JSON.stringify(data);
      if (statusStr !== logger.lastNotificationStatus) {
        console.info('[Notification]', new Date().toISOString(), message, data);
        logger.lastNotificationStatus = statusStr;
      }
      return;
    }
    
    // Alle anderen Notification-Logs normal ausgeben
    console.info('[Notification]', new Date().toISOString(), message, data);
  },
  
  apiResponse: (endpoint, data) => {
    if (LOG_LEVEL === 'debug') {
      console.group(`[API Response] ${new Date().toISOString()} - ${endpoint}`);
      console.log('Raw data:', data);
      if (data?.temps) {
        console.log('Temperature data:', data.temps);
      } else {
        console.warn('No temperature data found!');
      }
      console.log('Status:', data?.status);
      console.log('Progress:', data?.progress);
      console.groupEnd();
    }
  }
};

export default logger; 