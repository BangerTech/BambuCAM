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
import { Logger, LOG_CATEGORIES } from '../utils/logger';
import InfoIcon from '@mui/icons-material/Info';

// Styled Components
const NeonDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiPaper-root': {
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)',
    border: theme.palette.mode === 'dark' 
      ? '1px solid #00ffff' 
      : '1px solid #008080',
    boxShadow: theme.palette.mode === 'dark' 
      ? '0 0 10px #00ffff' 
      : '0 0 10px rgba(0, 128, 128, 0.3)',
    color: theme.palette.mode === 'dark' ? '#fff' : '#333'
  }
}));

const NeonButton = styled(Button)(({ theme }) => ({
  color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  borderColor: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(0, 255, 255, 0.1)' 
      : 'rgba(0, 128, 128, 0.1)',
    borderColor: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  },
  '&.Mui-disabled': {
    borderColor: theme.palette.mode === 'dark' 
      ? 'rgba(0, 255, 255, 0.3)' 
      : 'rgba(0, 128, 128, 0.3)',
    color: theme.palette.mode === 'dark' 
      ? 'rgba(0, 255, 255, 0.3)' 
      : 'rgba(0, 128, 128, 0.3)',
  }
}));

const NeonTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    color: theme.palette.mode === 'dark' ? '#fff' : '#333',
    '& fieldset': {
      borderColor: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
    },
    '&:hover fieldset': {
      borderColor: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
    },
  },
  '& .MuiInputLabel-root': {
    color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
    '&.Mui-focused': {
      color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
    },
  },
}));

const NeonStepper = styled(Stepper)(({ theme }) => ({
  '& .MuiStepIcon-root': {
    color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  },
  '& .MuiStepIcon-root.Mui-active': {
    color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
    filter: theme.palette.mode === 'dark' ? 'drop-shadow(0 0 2px #00ffff)' : 'drop-shadow(0 0 2px rgba(0, 128, 128, 0.5))',
  },
  '& .MuiStepIcon-root.Mui-completed': {
    color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  },
  '& .MuiStepLabel-label': {
    color: theme.palette.mode === 'dark' ? '#fff' : '#333',
  },
  '& .MuiStepConnector-line': {
    borderColor: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  }
}));

const NotificationDialog = ({ open, onClose }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [botUsername, setBotUsername] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const steps = [
    'Create Bot',
    'Enter Token',
    'Done!'
  ];

  const handleSave = async () => {
    try {
      setError('');
      setIsLoading(true);
      
      // Debug-Log hinzufügen
      Logger.notification('Sending token:', { token });
      
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
        color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
        textAlign: 'center',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        textShadow: theme => theme.palette.mode === 'dark' ? '0 0 10px #00ffff' : 'none',
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
          sx={{ color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}
        >
          <InfoIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Collapse in={showGuide}>
          <Box sx={{ mb: 3, mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>
              Setup Guide:
            </Typography>
            <ol style={{ paddingLeft: '20px', color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>
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
            <Typography variant="h6" gutterBottom sx={{ color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>
              1. Create Bot
            </Typography>
            <Typography paragraph sx={{ color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>
              • Open <Link href="https://t.me/BotFather" target="_blank" sx={{ color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>@BotFather</Link> in Telegram
            </Typography>
            <Typography paragraph sx={{ color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>
              • Send <code style={{ color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>/newbot</code> and follow the instructions
            </Typography>
            <Typography paragraph sx={{ color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>
              • Copy the Bot Token
            </Typography>
            <NeonButton 
              variant="outlined"
              onClick={() => setActiveStep(1)}
              sx={{ mt: 2 }}
            >
              Next
            </NeonButton>
          </Box>
        )}

        {activeStep === 1 && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom sx={{ color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>
              2. Enter Token
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
                Back
              </NeonButton>
              <NeonButton 
                variant="outlined"
                onClick={handleSave}
                disabled={!token}
              >
                {isLoading ? <CircularProgress size={24} sx={{ color: '#00ffff' }} /> : 'Save'}
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
              Almost done! Click the button below to start the bot:
            </Alert>

            <NeonButton
              variant="outlined"
              href={`https://t.me/${botUsername}?start=1`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ marginBottom: 2 }}
            >
              START BOT
            </NeonButton>

            <Typography variant="body2" sx={{ color: '#888' }}>
              After starting the bot, you can close this dialog.
            </Typography>
          </Box>
        )}
      </DialogContent>
    </NeonDialog>
  );
};

export default NotificationDialog; 