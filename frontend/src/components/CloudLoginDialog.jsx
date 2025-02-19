import React, { useState } from 'react';
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

const GlassDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0, 255, 255, 0.2)',
    borderRadius: '15px',
    boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)'
  }
}));

const NeonTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'rgba(0, 255, 255, 0.3)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(0, 255, 255, 0.5)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#00ffff',
    }
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255, 255, 255, 0.7)',
    '&.Mui-focused': {
      color: '#00ffff'
    }
  },
  '& .MuiInputBase-input': {
    color: 'white'
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

// API URL definieren
const API_URL = `http://${window.location.hostname}:4000`;

const CloudLoginDialog = ({ open, onClose, onLogin }) => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (isLoading) return; // Verhindert doppelte Ausführung
    
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch(`${API_URL}/api/cloud/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          verification_code: verificationCode || undefined
        })
      });

      const data = await response.json();
      console.log('Login response:', data);
      
      if (data.needs_verification) {
        setNeedsVerification(true);
        setError(data.error);
        return;
      }
      
      if (data.success) {
        await onLogin(data);
        onClose();
      } else {
        setError(data.error || 'Login fehlgeschlagen');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Login fehlgeschlagen: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GlassDialog open={open} onClose={onClose}>
      <DialogTitle>Cloud Login</DialogTitle>
      <DialogContent>
        {error && (
          <Alert 
            severity={needsVerification ? "info" : "error"}  // Info statt Error bei Verification
            sx={{ 
              mb: 2,
              background: needsVerification ? 'rgba(0, 255, 255, 0.1)' : 'rgba(255, 0, 0, 0.1)',
              border: needsVerification ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid rgba(255, 0, 0, 0.3)'
            }}
          >
            {error}
          </Alert>
        )}
        <Box sx={{ mt: 2 }}>
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
          {needsVerification && (
            <NeonTextField
              label="Verification Code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              fullWidth
              margin="normal"
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <NeonButton 
          onClick={onClose} 
          variant="outlined"
          disabled={isLoading}
        >
          Cancel
        </NeonButton>
        <NeonButton 
          onClick={handleLogin} 
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