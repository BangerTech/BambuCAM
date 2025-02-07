import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { API_URL } from '../config';

const WhatsAppDialog = ({ open, onClose }) => {
  const [number, setNumber] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      setError('');
      
      const response = await fetch(`${API_URL}/notifications/whatsapp/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }
      
      setError('Please scan the QR code in the opened browser window');
    } catch (error) {
      setError('Error during WhatsApp login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSave = async () => {
    try {
      setError('');
      const response = await fetch(`${API_URL}/notifications/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ number: number })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.needs_login) {
          await handleLogin();
          return;
        }
        throw new Error(data.error || 'Failed to save number');
      }

      setSuccess(data.message || 'WhatsApp number saved successfully');
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      setError(error.message);
      console.error('Error:', error);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: {
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          borderRadius: '15px'
        }
      }}
    >
      <DialogTitle sx={{ color: '#00ffff' }}>
        WhatsApp Notifications
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Typography sx={{ color: '#00ffff', mb: 2 }}>
          Enter your WhatsApp number (with country code):
        </Typography>
        <TextField
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="+491234567890"
          fullWidth
          disabled={isLoggingIn}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#00ffff',
              '& fieldset': {
                borderColor: 'rgba(0, 255, 255, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(0, 255, 255, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#00ffff',
              }
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={onClose}
          disabled={isLoggingIn}
          sx={{ 
            color: '#00ffff',
            '&:hover': {
              backgroundColor: 'rgba(0, 255, 255, 0.1)'
            }
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          disabled={isLoggingIn || !number}
          sx={{ 
            color: '#00ffff',
            '&:hover': {
              backgroundColor: 'rgba(0, 255, 255, 0.1)'
            }
          }}
        >
          {isLoggingIn ? <CircularProgress size={24} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WhatsAppDialog; 