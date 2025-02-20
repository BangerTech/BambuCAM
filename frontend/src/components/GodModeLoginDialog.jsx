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
  const [savedCredentials, setSavedCredentials] = useState(() => {
    // Prüfe ob gespeicherte Credentials existieren
    const saved = sessionStorage.getItem('godModeCredentials');
    return saved ? JSON.parse(saved) : null;
  });
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
      // Verwende gespeicherte Credentials falls vorhanden
      const loginEmail = savedCredentials?.email || email;
      const loginPassword = savedCredentials?.password || password;
      
      const response = await fetch(`${API_URL}/cloud/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          verification_code: needs2FA ? verificationCode : undefined
        }),
      });

      if (!response.ok) {
        // Bei Fehler: Lösche gespeicherte Credentials
        sessionStorage.removeItem('godModeCredentials');
        setSavedCredentials(null);
        throw new Error('Login failed');
      }

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
        
        // Speichere erfolgreiche Credentials für die Session
        if (!savedCredentials) {
          const credentials = { email: loginEmail, password: loginPassword };
          sessionStorage.setItem('godModeCredentials', JSON.stringify(credentials));
          setSavedCredentials(credentials);
        }
        
        // Coole Aktivierungs-Animation
        startGodModeAnimation();
      } else if (data.error) {
        setError(data.error);
        if (needs2FA) {
          // Bei 2FA Fehler: Zurück zum normalen Login
          setNeeds2FA(false);
          setVerificationCode('');
        }
      } else {
        setError('Login fehlgeschlagen');
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

  // Automatischer Login wenn Credentials vorhanden
  useEffect(() => {
    if (open && savedCredentials) {
      handleLogin();
    }
  }, [open]);

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
            <Alert severity="error" sx={{ mb: 2 }}>
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
    </Dialog>
  );
};

export default GodModeLoginDialog; 