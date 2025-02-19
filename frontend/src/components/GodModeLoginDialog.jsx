import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, TextField, Button, Box, CircularProgress, Alert } from '@mui/material';
import { API_URL } from '../config';

const GodModeLoginDialog = ({ open, onClose, onGodModeActivate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/cloud/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          verification_code: verificationCode
        }),
      });

      const data = await response.json();
      console.log('Login response:', data);

      if (data.needs_verification) {
        setNeeds2FA(true);
        setError('2FA erforderlich. Bitte prüfen Sie Ihre E-Mail für den Code.');
        return;
      }

      if (data.success && data.token) {
        // Speichere Token
        localStorage.setItem('cloudToken', data.token);
        
        // Coole Aktivierungs-Animation
        startGodModeAnimation();
      } else {
        setError(data.error || 'Login fehlgeschlagen');
      }
    } catch (err) {
      console.log('Login error:', err);
      if (mounted.current) {
        setError('Verbindungsfehler');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  };

  const startGodModeAnimation = () => {
    console.log('Starte God Mode Animation...');
    
    // Overlay für Fullscreen-Animation
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'transparent';
    overlay.style.transition = 'all 0.5s ease';
    overlay.style.zIndex = '9999';
    document.body.appendChild(overlay);

    // Sequenz von Effekten
    setTimeout(() => {
      overlay.style.backgroundColor = 'rgba(0, 255, 255, 0.3)';  // Cyan
      document.body.style.filter = 'brightness(1.5) contrast(1.2)';
    }, 0);

    setTimeout(() => {
      overlay.style.backgroundColor = 'rgba(147, 51, 234, 0.6)'; // Violett
      document.body.style.filter = 'brightness(2) contrast(1.4)';
    }, 500);

    setTimeout(() => {
      overlay.style.backgroundColor = 'rgba(0, 255, 255, 0.2)'; // Cyan
      document.body.style.filter = 'brightness(1.2) contrast(1.1)';
    }, 1000);

    setTimeout(() => {
      overlay.style.backgroundColor = 'transparent';
      document.body.style.filter = '';
      overlay.remove();
      console.log('God Mode Animation abgeschlossen!');
      // Aktiviere God Mode nach der Animation
      if (typeof onGodModeActivate === 'function') {
        onGodModeActivate();
      }
      onClose();
    }, 1500);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: {
          background: 'rgba(0, 0, 0, 0.9)',
          border: '2px solid #00ffff',
          boxShadow: '0 0 20px #00ffff',
          borderRadius: '1rem',
          minWidth: '300px'
        }
      }}
    >
      <DialogTitle sx={{ 
        color: '#00ffff',
        textAlign: 'center',
        fontSize: '1.5rem',
        textShadow: '0 0 10px #00ffff'
      }}>
        🔮 Enter God Mode 🔮
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            variant="outlined"
            disabled={loading || needs2FA}
          />
          
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="outlined"
            disabled={loading || needs2FA}
          />
          
          {needs2FA && (
            <TextField
              label="2FA Code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              variant="outlined"
              disabled={loading}
            />
          )}
          
          <Button
            onClick={handleLogin}
            disabled={loading || (!needs2FA && (!email || !password)) || (needs2FA && !verificationCode)}
            sx={{
              mt: 2,
              background: 'rgba(0, 255, 255, 0.1)',
              color: '#00ffff',
              border: '1px solid #00ffff',
              '&:hover': {
                background: 'rgba(0, 255, 255, 0.2)',
                boxShadow: '0 0 10px #00ffff'
              }
            }}
          >
            {loading ? <CircularProgress size={24} /> : 'Activate God Mode'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default GodModeLoginDialog; 