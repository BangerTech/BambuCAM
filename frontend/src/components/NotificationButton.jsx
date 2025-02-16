import React, { useState, useEffect } from 'react';
import { Fab, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import NotificationDialog from './NotificationDialog';
import { API_URL } from '../config';
import logger from '../utils/logger';

const NotificationButton = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const checkStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/notifications/telegram/status`);
      const data = await response.json();
      
      if (response.ok) {
        setNotificationsEnabled(data.enabled);
        logger.notification('Checking notification status:', data);
      }
    } catch (error) {
      logger.error('Error checking notification status:', error);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    if (notificationsEnabled) {
      try {
        const response = await fetch(`${API_URL}/notifications/telegram/disable`, {
          method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
          setNotificationsEnabled(false);
          logger.notification('Notifications disabled');
        }
      } catch (error) {
        logger.error('Error disabling notifications:', error);
      }
    } else {
      setDialogOpen(true);
    }
  };

  const handleDialogClose = (success = false) => {
    setDialogOpen(false);
    if (success) {
      checkStatus();
    }
  };

  return (
    <>
      <Tooltip title={`${notificationsEnabled ? 'Disable' : 'Enable'} Telegram Notifications`}>
        <Fab
          size="small"
          onClick={handleToggle}
          sx={{ 
            position: 'fixed',
            bottom: 15,
            right: 15,
            width: 40,
            height: 40,
            minHeight: 'unset',
            bgcolor: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid #00ffff',
            color: '#00ffff',
            '&:hover': {
              bgcolor: 'rgba(0, 255, 255, 0.1)',
            },
            boxShadow: notificationsEnabled ? 
              '0 0 5px #00ffff, 0 0 10px #00ffff' : 
              'none'
          }}
        >
          {notificationsEnabled ? <NotificationsIcon /> : <NotificationsOffIcon />}
        </Fab>
      </Tooltip>

      <NotificationDialog 
        open={dialogOpen}
        onClose={handleDialogClose}
      />
    </>
  );
};

export default NotificationButton; 