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
  Alert,
  LinearProgress
} from '@mui/material';
import { API_URL } from '../config';

const WhatsAppDialog = ({ open, onClose }) => {
  const [number, setNumber] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState(0);

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

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      setError(data.message || 'Please scan the QR code in the opened browser window');
      
      await checkLoginStatus();
      
      await handleSave();
      
    } catch (error) {
      setError(error.message || 'Error during WhatsApp login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const checkLoginStatus = async (maxAttempts = 30) => {  // 1 Minute max
    try {
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        const response = await fetch(`${API_URL}/notifications/whatsapp/status`);
        const data = await response.json();
        
        if (data.is_logged_in) {
          return true;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      throw new Error('Login-Timeout: QR-Code wurde nicht gescannt');
    } catch (error) {
      console.error('Error checking login status:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    try {
      setError('');
      setSuccess('');  // Reset success message
      setIsLoggingIn(true);
      setProgress(0);
      
      const response = await fetch(`${API_URL}/notifications/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ number: number })
      });

      const data = await response.json();
      
      if (response.status === 401) { // WhatsApp not logged in
        // Starte Login-Prozess
        const loginResponse = await fetch(`${API_URL}/notifications/whatsapp/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        const loginData = await loginResponse.json();
        
        if (!loginResponse.ok) {
          throw new Error(loginData.error || 'Login failed');
        }

        setError(loginData.message);
        
        // Progress-Bar während des Auto-Logins
        const startTime = Date.now();
        const duration = 10000; // 10 Sekunden
        
        const updateProgress = () => {
          const elapsed = Date.now() - startTime;
          const newProgress = Math.min((elapsed / duration) * 100, 100);
          setProgress(newProgress);
        };

        const progressInterval = setInterval(updateProgress, 100);
        
        try {
          await checkLoginStatus();
          clearInterval(progressInterval);
          setProgress(100);
          await handleSave();
        } catch (error) {
          clearInterval(progressInterval);
          setError(error.message);
        }
        return;
      } else if (response.ok) {
        setSuccess(data.message || 'WhatsApp number saved successfully');
        // Zeige Erfolg für 2 Sekunden
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to save number');
      }

    } catch (error) {
      setError(error.message);
      console.error('Error:', error);
    } finally {
      setIsLoggingIn(false);
      setProgress(0);
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
            {progress > 0 && (
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ 
                  mt: 1,
                  backgroundColor: 'rgba(0, 255, 255, 0.2)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#00ffff'
                  }
                }}
              />
            )}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
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