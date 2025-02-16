import React, { useState, useEffect, useCallback } from 'react';
import { Fab, Tooltip, IconButton, Badge, Snackbar } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import NotificationDialog from './NotificationDialog';
import { API_URL } from '../config';
import logger from '../utils/logger';

const NotificationButton = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pressTimer, setPressTimer] = useState(null);
  const [tooltipText, setTooltipText] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

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

  useEffect(() => {
    if (notificationsEnabled) {
      setTooltipText('Click to disable notifications\nLong press to reset configuration');
    } else {
      setTooltipText('Click to enable notifications\nLong press to reset configuration');
    }
  }, [notificationsEnabled]);

  const handlePressStart = useCallback(() => {
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/notifications/telegram/reset`, {
          method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
          logger.notification('Notification configuration reset');
          setNotificationsEnabled(false);
          setSnackbarOpen(true);
        }
      } catch (error) {
        logger.error('Error resetting notification config:', error);
      }
    }, 1000);
    setPressTimer(timer);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  }, [pressTimer]);

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
      try {
        // Prüfe erst, ob der Bot bereits konfiguriert ist
        const response = await fetch(`${API_URL}/notifications/telegram/status`);
        const data = await response.json();
        
        if (data.configured) {
          // Bot ist bereits konfiguriert, also nur aktivieren
          const enableResponse = await fetch(`${API_URL}/notifications/telegram/enable`, {
            method: 'POST'
          });
          const enableData = await enableResponse.json();
          if (enableData.success) {
            setNotificationsEnabled(true);
            logger.notification('Notifications enabled');
          }
        } else {
          // Bot muss erst eingerichtet werden
          setDialogOpen(true);
        }
      } catch (error) {
        logger.error('Error checking telegram status:', error);
        setDialogOpen(true);
      }
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
      <Tooltip 
        title={tooltipText}
        placement="left"
      >
        <Fab
          size="small"
          onClick={handleToggle}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
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

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message="Notification settings have been reset"
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: '#00ffff',
            border: '1px solid #00ffff',
            boxShadow: '0 0 10px #00ffff'
          }
        }}
      />
    </>
  );
};

export default NotificationButton; 