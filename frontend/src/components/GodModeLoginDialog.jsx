import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, TextField, Button, Box, CircularProgress, Alert, DialogActions } from '@mui/material';
import { API_URL } from '../config';

const GodModeLoginDialog = ({ open, onClose, onGodModeActivate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savedCredentials, setSavedCredentials] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    if (open) {
      // Prüfe auf gespeicherte Credentials in bambu_cloud.json
      fetch(`${API_URL}/cloud/check-credentials`)
        .then(response => response.json())
        .then(data => {
          if (data.hasCredentials) {
            setSavedCredentials({
              email: data.email,
              useStoredCredentials: true
            });
            // Starte direkt den Login-Prozess
            handleLogin();
          }
        })
        .catch(error => {
          console.error('Error checking credentials:', error);
        });
    }
    return () => { mounted.current = false; };
  }, [open]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const loginData = savedCredentials || {
        email: email,
        password: password
      };
      
      const response = await fetch(`${API_URL}/cloud/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginData.email,
          useStoredCredentials: Boolean(savedCredentials),
          password: savedCredentials ? undefined : loginData.password,
          verification_code: verificationCode ? verificationCode : undefined
        }),
      });

      const data = await response.json();
      console.log('Login response:', data);

      if (data.needs_verification) {
        setNeeds2FA(true);
        setError(data.message || '2FA required. Please check your email for the code.');
        return;
      }

      if (!data.success) {
        setSavedCredentials(null);
        throw new Error(data.error || 'Login failed');
      }

      if (data.success && data.token) {
        // Speichere Token
        localStorage.setItem('cloudToken', data.token);
        
        // Coole Aktivierungs-Animation
        startGodModeAnimation();
      } else if (data.error) {
        setError(data.error);
        if (needs2FA) {
          // On 2FA error: Back to normal login
          setNeeds2FA(false);
          setVerificationCode('');
        }
      } else {
        setError('Login failed');
      }
    } catch (err) {
      console.log('Login error:', err);
      if (mounted.current) {
        setError('Connection error');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  };

  const startGodModeAnimation = () => {
    console.log('Starte God Mode Animation...');
    
    // Erstelle Lightning Overlay
    const lightningOverlay = document.createElement('div');
    lightningOverlay.style.position = 'fixed';
    lightningOverlay.style.top = '0';
    lightningOverlay.style.left = '0';
    lightningOverlay.style.width = '100vw';
    lightningOverlay.style.height = '100vh';
    lightningOverlay.style.zIndex = '9999';
    lightningOverlay.style.pointerEvents = 'none';
    lightningOverlay.style.mixBlendMode = 'screen'; // Macht Schwarz transparent
    
    // Video Lightning hinzufügen
    lightningOverlay.innerHTML = `
      <video
        autoplay
        muted
        style="
          position: fixed;
          width: 100%;
          height: 100%;
          object-fit: cover;
          mix-blend-mode: screen;
          filter: brightness(1.2) contrast(1.2);
        "
      >
        <source src="/lightning.mp4" type="video/mp4">
      </video>
    `;
    
    document.body.appendChild(lightningOverlay);
    
    // Sequenz von Effekten
    setTimeout(() => {
      document.body.style.filter = 'brightness(1.5) contrast(1.2)';
    }, 0);
    
    setTimeout(() => {
      document.body.style.filter = 'brightness(2) contrast(1.4)';
    }, 500);
    
    setTimeout(() => {
      document.body.style.filter = 'brightness(1.2) contrast(1.1)';
    }, 1000);
    
    setTimeout(() => {
      document.body.style.filter = '';
      lightningOverlay.remove();
      console.log('God Mode Animation abgeschlossen!');
      if (typeof onGodModeActivate === 'function') {
        onGodModeActivate();
      }
      onClose();
    }, 2500); // Längere Dauer für das Video
  };

  const handleReset = async () => {
    try {
      const response = await fetch(`${API_URL}/cloud/reset-credentials`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        setSavedCredentials(null);
        setNeeds2FA(false);
        setError(null);
        // Optional: Zeige Erfolgs-Nachricht
      }
    } catch (error) {
      console.error('Error resetting credentials:', error);
      setError('Failed to reset credentials');
    }
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <img 
            src="/thunder.png" 
            alt="Thunder"
            style={{ 
              width: '24px',
              height: '24px',
              filter: 'drop-shadow(0 0 5px #00ffff)'
            }} 
          />
          Enter God Mode
          <img 
            src="/thunder.png" 
            alt="Thunder"
            style={{ 
              width: '24px',
              height: '24px',
              filter: 'drop-shadow(0 0 5px #00ffff)'
            }} 
          />
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ 
              mb: 2,
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.3)',
              color: '#ff4444'
            }}>
              {error}
            </Alert>
          )}
          
          {!savedCredentials && (
            <TextField
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              variant="outlined"
              disabled={loading || needs2FA}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(0, 255, 255, 0.5)',
                  },
                  '&:hover fieldset': {
                    borderColor: '#00ffff',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#00ffff',
                  }
                },
                '& .MuiInputLabel-root': {
                  color: '#00ffff'
                },
                '& .MuiInputBase-input': {
                  color: '#00ffff'
                }
              }}
            />
          )}
          
          {!savedCredentials && (
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              variant="outlined"
              disabled={loading || needs2FA}
            />
          )}
          
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
      <DialogActions>
        {needs2FA && (
          <Button
            onClick={handleReset}
            sx={{
              mr: 'auto',
              color: '#ff4444',
              borderColor: 'rgba(255, 0, 0, 0.5)',
              '&:hover': {
                borderColor: '#ff4444',
                backgroundColor: 'rgba(255, 0, 0, 0.1)'
              }
            }}
          >
            Reset Login
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default GodModeLoginDialog; 