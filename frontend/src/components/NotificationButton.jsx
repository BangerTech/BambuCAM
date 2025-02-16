import React, { useState, useEffect } from 'react';
import { SpeedDial, SpeedDialIcon, SpeedDialAction, Snackbar, Alert } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import TelegramIcon from '@mui/icons-material/Telegram';
import { API_URL } from '../config';

const NotificationButton = () => {
    const [open, setOpen] = useState(false);
    const [telegramStatus, setTelegramStatus] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    useEffect(() => {
        checkTelegramStatus();
        const interval = setInterval(checkTelegramStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const checkTelegramStatus = async () => {
        try {
            const response = await fetch(`${API_URL}/notifications/telegram/status`);
            const data = await response.json();
            setTelegramStatus(data.connected);
        } catch (error) {
            console.error('Error checking Telegram status:', error);
        }
    };

    const handleTelegramConnect = async () => {
        try {
            const response = await fetch(`${API_URL}/notifications/telegram/connect`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                setSnackbar({
                    open: true,
                    message: 'Telegram connection initiated. Please check your Telegram for further instructions.',
                    severity: 'info'
                });
            } else {
                setSnackbar({
                    open: true,
                    message: data.error || 'Failed to connect to Telegram',
                    severity: 'error'
                });
            }
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Error connecting to Telegram',
                severity: 'error'
            });
        }
        setOpen(false);
    };

    const actions = [
        {
            icon: <TelegramIcon />,
            name: `Telegram ${telegramStatus ? '(Connected)' : '(Not Connected)'}`,
            action: handleTelegramConnect
        }
    ];

    return (
        <>
            <SpeedDial
                ariaLabel="Notification Settings"
                sx={{ position: 'fixed', bottom: 16, right: 16 }}
                icon={<SpeedDialIcon icon={<NotificationsIcon />} />}
                open={open}
                onOpen={() => setOpen(true)}
                onClose={() => setOpen(false)}
            >
                {actions.map((action) => (
                    <SpeedDialAction
                        key={action.name}
                        icon={action.icon}
                        tooltipTitle={action.name}
                        onClick={action.action}
                    />
                ))}
            </SpeedDial>

            {/* Styled Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                sx={{
                    '& .MuiPaper-root': {
                        borderRadius: '1.5rem',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(0, 255, 255, 0.3)',
                        boxShadow: '0 0 2rem rgba(0, 255, 255, 0.2)',
                        minWidth: '300px'
                    }
                }}
            >
                <Alert 
                    onClose={() => setSnackbar({ ...snackbar, open: false })} 
                    severity={snackbar.severity}
                    sx={{
                        width: '100%',
                        borderRadius: '1.5rem',
                        background: snackbar.severity === 'success' 
                            ? 'rgba(0, 180, 180, 0.95)'
                            : snackbar.severity === 'info'
                            ? 'rgba(0, 120, 180, 0.95)'
                            : 'rgba(180, 0, 0, 0.95)',
                        color: '#ffffff',
                        '& .MuiAlert-icon': {
                            color: '#ffffff'
                        },
                        '& .MuiAlert-action': {
                            color: '#ffffff'
                        }
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default NotificationButton; 