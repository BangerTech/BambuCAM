import React, { useState } from 'react';
import { Fab, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import NotificationDialog from './NotificationDialog';

const NotificationButton = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleToggle = () => {
    if (!notificationsEnabled) {
      setDialogOpen(true);
    } else {
      setNotificationsEnabled(false);
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
        onClose={() => {
          setDialogOpen(false);
          setNotificationsEnabled(true);
        }}
      />
    </>
  );
};

export default NotificationButton; 