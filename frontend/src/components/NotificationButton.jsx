import React, { useState, useEffect } from 'react';
import { Fab, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import NotificationDialog from './NotificationDialog';
import { API_URL } from '../config';

const NotificationButton = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // checkStatus in den Komponenten-Scope verschieben
  const checkStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/notifications/status`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setNotificationsEnabled(data.telegram);
        console.log('Notification status:', data.telegram);
      } else {
        console.warn('Failed to get notification status:', data);
      }
    } catch (error) {
      console.error('Error checking notification status:', error);
    }
  };

  // useEffect verwendet jetzt die Funktion aus dem Komponenten-Scope
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    if (notificationsEnabled) {
      // Deaktiviere Benachrichtigungen
      try {
        const response = await fetch(`${API_URL}/notifications/disable`, {
          method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
          setNotificationsEnabled(false);
        }
      } catch (error) {
        console.error('Error disabling notifications:', error);
      }
    } else {
      // Prüfe ob Bot schon eingerichtet wurde
      try {
        // Prüfe ob eine chat_id existiert
        const response = await fetch(`${API_URL}/notifications/telegram/status`);
        const data = await response.json();
        
        if (data.success && data.is_configured) {
          // Bot ist schon eingerichtet, aktiviere einfach wieder
          const enableResponse = await fetch(`${API_URL}/notifications/enable`, {
            method: 'POST'
          });
          const enableData = await enableResponse.json();
          if (enableData.success) {
            setNotificationsEnabled(true);
          }
        } else {
          // Bot muss erst eingerichtet werden
          setDialogOpen(true);
        }
      } catch (error) {
        console.error('Error checking telegram status:', error);
        setDialogOpen(true);
      }
    }
  };

  const handleDialogClose = (success = false) => {
    setDialogOpen(false);
    if (success) {
      checkStatus(); // Jetzt ist checkStatus verfügbar
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
        onClose={(success) => handleDialogClose(success)}
      />
    </>
  );
};

export default NotificationButton; 