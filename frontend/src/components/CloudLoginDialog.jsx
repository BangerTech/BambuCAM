import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Box
} from '@mui/material';
import styled from '@emotion/styled';
import { API_URL } from '../config';

const GlassDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0, 255, 255, 0.2)',
    borderRadius: '15px',
    boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)',
    color: '#00ffff',
    '& .MuiDialogTitle-root': {
      color: '#00ffff'
    }
  }
}));

const NeonTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'rgba(0, 255, 255, 0.5)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(0, 255, 255, 0.5)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#00ffff',
    }
  },
  '& .MuiInputLabel-root': {
    color: '#00ffff',
    '&.Mui-focused': {
      color: '#00ffff'
    }
  },
  '& .MuiInputBase-input': {
    color: '#00ffff'
  }
}));

const NeonButton = styled(Button)(({ theme }) => ({
  background: 'rgba(0, 255, 255, 0.1)',
  border: '1px solid rgba(0, 255, 255, 0.3)',
  color: '#00ffff',
  '&:hover': {
    background: 'rgba(0, 255, 255, 0.2)',
    boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)'
  }
}));

const CloudLoginDialog = ({ open, onClose, onLogin, needsVerification, setNeedsVerification }) => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleLogin = async (loginCredentials = credentials) => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      setError('');
      
      console.log('Starte Login mit:', loginCredentials.email);
      
      const response = await fetch(`${API_URL}/cloud/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: loginCredentials.email,
          useStoredCredentials: !loginCredentials.password,
          password: loginCredentials.password || undefined,
          verification_code: verificationCode ? verificationCode : undefined
        })
      });

      const data = await response.json();
      console.log('Login Response:', data);
      
      if (data.needs_verification) {
        setNeedsVerification(true);
        setCredentials(prev => ({
          ...prev,
          email: loginCredentials.email
        }));
        setError(data.message || 'Please enter the verification code sent to your email.');
        return;
      }
      
      if (data.success && data.token) {
        await onLogin(data);
        onClose();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      const response = await fetch(`${API_URL}/cloud/reset-credentials`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        onClose();
        // Optional: Zeige Erfolgs-Nachricht
      }
    } catch (error) {
      console.error('Error resetting credentials:', error);
      setError('Failed to reset credentials');
    }
  };

  return (
    <GlassDialog open={open} onClose={onClose}>
      <DialogTitle>Cloud Login</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity={needsVerification ? "info" : "error"}>
            {error}
          </Alert>
        )}
        {!needsVerification ? (
          <>
            <NeonTextField
              label="Email"
              value={credentials.email}
              onChange={(e) => setCredentials(prev => ({...prev, email: e.target.value}))}
              fullWidth
              margin="normal"
            />
            <NeonTextField
              label="Password"
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({...prev, password: e.target.value}))}
              fullWidth
              margin="normal"
            />
          </>
        ) : (
          <NeonTextField
            label="Verification Code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            fullWidth
            margin="normal"
          />
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        {needsVerification && (
          <NeonButton 
            onClick={handleReset}
            variant="outlined"
            color="error"
            sx={{
              borderColor: 'rgba(255, 0, 0, 0.5)',
              color: '#ff4444',
              mr: 'auto',
              '&:hover': {
                borderColor: '#ff4444',
                backgroundColor: 'rgba(255, 0, 0, 0.1)'
              }
            }}
          >
            Reset Login
          </NeonButton>
        )}
        <NeonButton 
          onClick={onClose} 
          variant="outlined"
          disabled={isLoading}
        >
          Cancel
        </NeonButton>
        <NeonButton 
          onClick={() => handleLogin()} 
          variant="contained"
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Login'}
        </NeonButton>
      </DialogActions>
    </GlassDialog>
  );
};

export default CloudLoginDialog; 