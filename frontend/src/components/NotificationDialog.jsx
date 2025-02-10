import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Typography,
  Alert,
  TextField,
  Link,
  Box,
  CircularProgress,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { API_URL } from '../config';
import { styled } from '@mui/material/styles';

// Styled Components
const NeonDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiPaper-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    border: '1px solid #00ffff',
    boxShadow: '0 0 10px #00ffff',
    color: '#fff'
  }
}));

const NeonButton = styled(Button)(({ theme }) => ({
  color: '#00ffff',
  borderColor: '#00ffff',
  '&:hover': {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderColor: '#00ffff',
  },
  '&.Mui-disabled': {
    borderColor: 'rgba(0, 255, 255, 0.3)',
    color: 'rgba(0, 255, 255, 0.3)',
  }
}));

const NeonTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': {
      borderColor: '#00ffff',
    },
    '&:hover fieldset': {
      borderColor: '#00ffff',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#00ffff',
    },
  },
  '& .MuiInputLabel-root': {
    color: '#00ffff',
    '&.Mui-focused': {
      color: '#00ffff',
    },
  },
});

const NeonStepper = styled(Stepper)({
  '& .MuiStepIcon-root': {
    color: '#00ffff',
  },
  '& .MuiStepIcon-root.Mui-active': {
    color: '#00ffff',
    filter: 'drop-shadow(0 0 2px #00ffff)',
  },
  '& .MuiStepIcon-root.Mui-completed': {
    color: '#00ffff',
  },
  '& .MuiStepLabel-label': {
    color: '#fff',
  },
  '& .MuiStepConnector-line': {
    borderColor: '#00ffff',
  }
});

const NotificationDialog = ({ open, onClose }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [botUsername, setBotUsername] = useState('');

  const steps = [
    'Bot erstellen',
    'Token eingeben',
    'Fertig!'
  ];

  const handleSave = async () => {
    try {
      setError('');
      setIsLoading(true);
      
      const response = await fetch(`${API_URL}/notifications/telegram/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();
      
      if (data.success) {
        setBotUsername(data.botUsername); // Speichere den Bot-Username
        setActiveStep(2); // Gehe zum nächsten Schritt
      } else {
        throw new Error(data.error || 'Failed to setup Telegram');
      }

    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <NeonDialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        style: {
          padding: '20px'
        }
      }}
    >
      <DialogTitle sx={{ 
        color: '#00ffff',
        textAlign: 'center',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        textShadow: '0 0 10px #00ffff'
      }}>
        Telegram Benachrichtigungen einrichten
      </DialogTitle>

      <DialogContent>
        <NeonStepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </NeonStepper>

        {activeStep === 0 && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#00ffff' }}>
              1. Bot erstellen
            </Typography>
            <Typography paragraph sx={{ color: '#fff' }}>
              • Öffne <Link href="https://t.me/BotFather" target="_blank" sx={{ color: '#00ffff' }}>@BotFather</Link> in Telegram
            </Typography>
            <Typography paragraph sx={{ color: '#fff' }}>
              • Sende <code style={{ color: '#00ffff' }}>/newbot</code> und folge den Anweisungen
            </Typography>
            <Typography paragraph sx={{ color: '#fff' }}>
              • Kopiere den Bot-Token
            </Typography>
            <NeonButton 
              variant="outlined"
              onClick={() => setActiveStep(1)}
              sx={{ mt: 2 }}
            >
              Weiter
            </NeonButton>
          </Box>
        )}

        {activeStep === 1 && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#00ffff' }}>
              2. Token eingeben
            </Typography>
            <NeonTextField
              fullWidth
              label="Bot Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              margin="normal"
              variant="outlined"
              disabled={isLoading}
            />
            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mt: 2,
                  backgroundColor: 'rgba(211, 47, 47, 0.3)',
                  color: '#ff4444',
                  border: '1px solid #ff4444'
                }}
              >
                {error}
              </Alert>
            )}
            <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
              <NeonButton 
                variant="outlined"
                onClick={() => setActiveStep(0)}
                disabled={isLoading}
              >
                Zurück
              </NeonButton>
              <NeonButton 
                variant="outlined"
                onClick={handleSave}
                disabled={!token || isLoading}
              >
                {isLoading ? <CircularProgress size={24} sx={{ color: '#00ffff' }} /> : 'Speichern'}
              </NeonButton>
            </Box>
          </Box>
        )}

        {activeStep === 2 && (
          <Box sx={{ textAlign: 'center' }}>
            <Alert 
              severity="info"
              sx={{
                backgroundColor: 'rgba(0, 255, 255, 0.1)',
                color: '#00ffff',
                border: '1px solid #00ffff',
                marginBottom: 2
              }}
            >
              Fast geschafft! Klicken Sie auf den Button unten um den Bot zu starten:
            </Alert>

            <NeonButton
              variant="outlined"
              href={`https://t.me/${botUsername}?start=1`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ marginBottom: 2 }}
            >
              Bot starten
            </NeonButton>

            <Typography variant="body2" sx={{ color: '#888' }}>
              Nach dem Start des Bots können Sie diesen Dialog schließen.
            </Typography>
          </Box>
        )}
      </DialogContent>
    </NeonDialog>
  );
};

export default NotificationDialog; 