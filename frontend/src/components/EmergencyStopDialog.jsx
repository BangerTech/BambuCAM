import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box
} from '@mui/material';
import { styled } from '@mui/material/styles';
import WarningIcon from '@mui/icons-material/Warning';

// Styled Components
const NeonDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiPaper-root': {
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)',
    border: theme.palette.mode === 'dark' 
      ? '1px solid #ff0000' 
      : '1px solid #ff0000',
    boxShadow: theme.palette.mode === 'dark' 
      ? '0 0 10px #ff0000' 
      : '0 0 10px rgba(255, 0, 0, 0.3)',
    color: theme.palette.mode === 'dark' ? '#fff' : '#333'
  }
}));

const WarningText = styled(Typography)(({ theme }) => ({
  color: '#ff0000',
  textAlign: 'center',
  marginBottom: '20px',
  fontWeight: 'bold',
  textShadow: theme.palette.mode === 'dark' ? '0 0 5px rgba(255, 0, 0, 0.7)' : 'none',
}));

const NeonButton = styled(Button)(({ theme, buttonType }) => ({
  color: buttonType === 'warning' 
    ? '#ff0000' 
    : theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  borderColor: buttonType === 'warning' 
    ? '#ff0000' 
    : theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  '&:hover': {
    backgroundColor: buttonType === 'warning'
      ? 'rgba(255, 0, 0, 0.1)'
      : theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.1)' : 'rgba(0, 128, 128, 0.1)',
    borderColor: buttonType === 'warning' 
      ? '#ff0000' 
      : theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  }
}));

const WarningButton = styled(Button)(({ theme }) => ({
  color: '#ffffff',
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 0, 0, 0.7)' : 'rgba(255, 0, 0, 0.6)',
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 0, 0, 0.85)' : 'rgba(255, 0, 0, 0.75)',
  },
  fontSize: '0.85rem',
  padding: '4px 12px'
}));

const CancelButton = styled(Button)(({ theme }) => ({
  color: theme.palette.mode === 'dark' ? '#ffffff' : '#333333',
  borderColor: theme.palette.mode === 'dark' ? '#ffffff' : '#333333',
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.1)' 
      : 'rgba(0, 0, 0, 0.05)',
    borderColor: theme.palette.mode === 'dark' ? '#ffffff' : '#333333',
  },
  fontSize: '0.85rem',
  padding: '4px 12px'
}));

const EmergencyStopDialog = ({ open, onClose, onConfirm, printerName }) => {
  return (
    <NeonDialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        style: {
          padding: '6px'
        }
      }}
    >
      <DialogTitle sx={{ 
        color: theme => theme.palette.mode === 'dark' ? '#ff0000' : '#ff0000',
        textAlign: 'center',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        textShadow: theme => theme.palette.mode === 'dark' ? '0 0 10px #ff0000' : 'none',
        borderBottom: '1px solid rgba(255,0,0,0.3)',
        pb: 2
      }}>
        <WarningIcon fontSize="medium" />
        <span>EMERGENCY STOP</span>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ textAlign: 'center', my: 1 }}>
          <WarningText variant="body1" sx={{ mb: 1, fontSize: '0.95rem' }}>
            Are you sure you want to execute an emergency stop for printer "{printerName}"?
          </WarningText>
          <WarningText variant="body2" sx={{ fontSize: '0.85rem' }}>
            This will immediately halt all printer operations and may require a restart of the printer.
          </WarningText>
        </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 1, pt: 0 }}>
        <CancelButton variant="outlined" onClick={onClose}>
          Cancel
        </CancelButton>
        <WarningButton variant="contained" onClick={onConfirm}>
          Execute Emergency Stop
        </WarningButton>
      </DialogActions>
    </NeonDialog>
  );
};

export default EmergencyStopDialog; 