import React, { useState, useEffect } from 'react';
import { Fab, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';

const NotificationButton = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permission, setPermission] = useState(Notification.permission);

  const handleToggle = async () => {
    if (permission !== 'granted') {
      const newPermission = await Notification.requestPermission();
      setPermission(newPermission);
      if (newPermission === 'granted') {
        // Test notification when enabling
        const notification = new Notification("BambuCAM", {
          body: "Notifications enabled! 🔔",
          icon: '/printer-icon.png'
        });
        const audio = document.getElementById('notificationSound');
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(err => console.warn('Could not play sound:', err));
        }
        setTimeout(() => notification.close(), 3000);
      }
    }
    setNotificationsEnabled(prev => !prev);
    localStorage.setItem('notificationsEnabled', (!notificationsEnabled).toString());
  };

  useEffect(() => {
    const enabled = localStorage.getItem('notificationsEnabled') === 'true';
    setNotificationsEnabled(enabled);
  }, []);

  return (
    <Tooltip title={`${notificationsEnabled ? 'Disable' : 'Enable'} Notifications`}>
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
        {notificationsEnabled ? <NotificationsIcon sx={{ fontSize: 20 }} /> : <NotificationsOffIcon sx={{ fontSize: 20 }} />}
      </Fab>
    </Tooltip>
  );
};

export default NotificationButton; 