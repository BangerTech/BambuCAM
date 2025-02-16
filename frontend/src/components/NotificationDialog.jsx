import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  TextField,
  Link,
  Box,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Collapse
} from '@mui/material';
import { API_URL } from '../config';
import { styled } from '@mui/material/styles';
import logger from '../utils/logger';
import InfoIcon from '@mui/icons-material/Info';

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
  const [showGuide, setShowGuide] = useState(false);

  const steps = [
    'Bot erstellen',
    'Token eingeben',
    'Fertig!'
  ];

  const handleSave = async () => {
    try {
      setError('');
      setIsLoading(true);
      
      // Debug-Log hinzufügen
      logger.notification('Sending token:', { token });
      
      const response = await fetch(`${API_URL}/notifications/telegram/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();
      
      if (data.success) {
        setBotUsername(data.botUsername);
        setActiveStep(2);
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
        textShadow: '0 0 10px #00ffff',
        borderBottom: '1px solid rgba(0,0,0,0.1)',
        pb: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Telegram Notifications</span>
        <IconButton
          onClick={() => setShowGuide(!showGuide)}
          title="Setup Guide"
          sx={{ color: '#00ffff' }}
        >
          <InfoIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Collapse in={showGuide}>
          <Box sx={{ mb: 3, mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#00ffff' }}>
              Setup Guide:
            </Typography>
            <ol style={{ paddingLeft: '20px', color: '#00ffff' }}>
              <li>Create a new Telegram bot:
                <ul>
                  <li>Open Telegram and search for @BotFather</li>
                  <li>Send /newbot command</li>
                  <li>Choose a name for your bot</li>
                  <li>Choose a username ending in &quot;bot&quot;</li>
                  <li>Copy the API token you receive</li>
                </ul>
              </li>
              <li>Enter the token below and click Save</li>
              <li>Open the link to your bot and click Start</li>
              <li>You will now receive notifications about your prints</li>
            </ol>
          </Box>
        </Collapse>

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
              error={!!error}
              helperText={error}
            />
            <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
              <NeonButton 
                variant="outlined"
                onClick={() => setActiveStep(0)}
              >
                Zurück
              </NeonButton>
              <NeonButton 
                variant="outlined"
                onClick={handleSave}
                disabled={!token}
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
              BOT STARTEN
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