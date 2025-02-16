import React, { useState, useEffect } from 'react';
import logger from '../utils/logger';

const NotificationStatus = () => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/notifications/status`);
        const data = await response.json();
        logger.notification('Received notification status:', data);
        setStatus(data);
      } catch (error) {
        logger.error('Error fetching notification status:', error);
      }
    };
    fetchStatus();
  }, []);

  // ... Rest des Codes
};

export default NotificationStatus; 