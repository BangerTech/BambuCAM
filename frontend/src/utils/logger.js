const logger = {
  lastNotificationStatus: null,
  
  debug: (...args) => {
    // Immer loggen im Development
    console.debug('[Debug]', new Date().toISOString(), ...args);
  },
  
  info: (...args) => {
    console.info('[Info]', new Date().toISOString(), ...args);
  },
  
  error: (...args) => {
    console.error('[Error]', new Date().toISOString(), ...args);
  },
  
  api: (...args) => {
    console.info('[API]', new Date().toISOString(), ...args);
  },
  
  printer: (...args) => {
    console.info('[Printer]', new Date().toISOString(), ...args);
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
  }
};

export default logger; 