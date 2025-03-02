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
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    border: '1px solid rgba(255, 0, 0, 0.6)',
    boxShadow: '0 0 10px rgba(255, 0, 0, 0.4)',
    color: '#fff',
    maxWidth: '400px'
  }
}));

const WarningButton = styled(Button)(({ theme }) => ({
  color: '#ffffff',
  backgroundColor: 'rgba(255, 0, 0, 0.7)',
  '&:hover': {
    backgroundColor: 'rgba(255, 0, 0, 0.85)',
  },
  fontSize: '0.85rem',
  padding: '4px 12px'
}));

const CancelButton = styled(Button)(({ theme }) => ({
  color: '#ffffff',
  borderColor: '#ffffff',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: '#ffffff',
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
        color: 'rgba(255, 0, 0, 0.8)',
        textAlign: 'center',
        fontSize: '1.3rem',
        fontWeight: 'bold',
        textShadow: '0 0 10px rgba(255, 0, 0, 0.4)',
        pb: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 1
      }}>
        <WarningIcon fontSize="medium" />
        <span>EMERGENCY STOP</span>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ textAlign: 'center', my: 1 }}>
          <Typography variant="body1" sx={{ color: '#fff', mb: 1, fontSize: '0.95rem' }}>
            Are you sure you want to execute an emergency stop for printer "{printerName}"?
          </Typography>
          <Typography variant="body2" sx={{ color: '#fff', fontSize: '0.85rem' }}>
            This will immediately halt all printer operations and may require a restart of the printer.
          </Typography>
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