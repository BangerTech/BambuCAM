import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel, Box, Typography, List, ListItem, ListItemText, IconButton, Collapse, Grid, Chip } from '@mui/material';
import styled from '@emotion/styled';
import InfoIcon from '@mui/icons-material/Info';
import { CircularProgress } from '@mui/material';
import { Logger, LOG_CATEGORIES } from '../utils/logger';

const GlassDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0, 255, 255, 0.2)',
    borderRadius: '15px',
    boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)',
    minWidth: { xs: '90vw', sm: '400px' },
    maxWidth: { xs: '95vw', sm: '90vw', md: '600px' },
    maxHeight: { xs: '95vh', sm: '90vh' },
    margin: { xs: '10px', sm: 'auto' },
    color: '#00ffff'
  }
}));

const NeonButton = styled(Button)({
  background: 'rgba(0, 0, 0, 0.8)',
  color: '#00ffff',
  border: '1px solid rgba(0, 255, 255, 0.3)',
  '&:hover': {
    background: 'rgba(0, 255, 255, 0.2)',
    boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)'
  }
});

const NeonTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'rgba(0, 255, 255, 0.5)'
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
  },
  '& .MuiSelect-icon': {
    color: '#00ffff'
  }
});

const PrinterCard = styled(Box)(({ theme }) => ({
  background: 'rgba(0, 0, 0, 0.6)',
  borderRadius: '10px',
  padding: '15px',
  border: '1px solid rgba(0, 255, 255, 0.3)',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  '&:hover': {
    border: '1px solid rgba(0, 255, 255, 0.8)',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)',
    transform: 'translateY(-2px)'
  }
}));

const ModeBadge = styled(Chip)(({ mode }) => ({
  position: 'absolute',
  top: '10px',
  right: '10px',
  backgroundColor: mode === 'lan' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(0, 150, 255, 0.2)',
  color: mode === 'lan' ? '#00ff00' : '#00ffff',
  border: `1px solid ${mode === 'lan' ? '#00ff00' : '#00ffff'}`,
  fontSize: '0.75rem',
  height: '24px'
}));

const ScanButton = styled(Button)({
  width: '100%',
  marginTop: '20px',
  marginBottom: '20px',
  padding: '10px',
  background: 'rgba(0, 0, 0, 0.8)',
  color: '#00ffff',
  border: '1px solid #00ffff',
  borderRadius: '8px',
  textTransform: 'none',
  fontSize: '1rem',
  '&:hover': {
    background: 'rgba(0, 255, 255, 0.1)',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)',
  },
  '&.Mui-disabled': {
    color: 'rgba(0, 255, 255, 0.3)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
  }
});

const PRINTER_TYPES = {
  BAMBULAB: {
    name: 'Bambu Lab',
    streamUrlTemplate: 'rtsps://bblp:{accessCode}@{ip}:322/streaming/live/1',
  },
  CREALITY: {
    name: 'Creality',
    streamUrlTemplate: 'http://{ip}:8080/?action=stream',
  },
  CUSTOM: {
    name: 'Custom / Other',
    streamUrlTemplate: '',
  }
};

const AddPrinterDialog = ({ 
  open, 
  onClose, 
  onAdd, 
  isAdding,
  isDarkMode,
  scannedPrinters = [],
  isScanning,
  scanTimer,
  onScan
}) => {
  const [showGuide, setShowGuide] = useState(false);
  const [newPrinter, setNewPrinter] = useState({
    name: '',
    ip: '',
    accessCode: '',
    type: 'BAMBULAB'
  });

  const handleScannedPrinterSelect = (printer) => {
    setNewPrinter({
      name: printer.name,
      ip: printer.ip,
      type: 'BAMBULAB',
      accessCode: ''
    });
  };

  return (
    <GlassDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ 
        borderBottom: '1px solid rgba(0, 255, 255, 0.1)',
        color: '#00ffff'
      }}>
        Add New Printer
      </DialogTitle>
      <DialogContent sx={{ 
        pt: 2,
        overflowY: 'auto',
        maxHeight: { xs: 'calc(100vh - 200px)', sm: 'auto' }
      }}>
        <Collapse in={showGuide}>
          <Box sx={{ mb: 3, mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              BambuLab Printer Setup:
            </Typography>
            <ol style={{ paddingLeft: '20px' }}>
              <li>Connect the printer to your network via LAN cable</li>
              <li>Enable LAN Mode Liveview:
                <ul>
                  <li>Go to "Settings" (gear icon) > "General"</li>
                  <li>Enable "LAN Mode Liveview"</li>
                  <li>Note down the Access Code</li>
                </ul>
              </li>
              <li>Find the IP address under:
                <ul>
                  <li>Settings > Network > IP Address</li>
                </ul>
              </li>
              <li>Click "Scan Network" or enter the IP manually</li>
            </ol>
          </Box>
        </Collapse>

        {/* Scan Button */}
        <ScanButton
          onClick={() => {
            Logger.info('Starting printer scan');
            onScan();
          }}
          disabled={isScanning}
          startIcon={isScanning && <CircularProgress size={20} color="inherit" />}
        >
          {isScanning ? `Scanning... (${scanTimer}s)` : 'SCAN NETWORK'}
        </ScanButton>

        {/* Found Printers Grid */}
        {scannedPrinters.length > 0 && (
          <Box sx={{ mt: 2, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, color: '#00ffff' }}>
              Found Printers:
            </Typography>
            <Grid container spacing={2}>
              {scannedPrinters.map((printer) => (
                <Grid item xs={12} sm={6} key={printer.id}>
                  <PrinterCard 
                    onClick={() => handleScannedPrinterSelect(printer)}
                    sx={{ position: 'relative', minHeight: '140px' }}
                  >
                    <ModeBadge 
                      label={printer.mode.toUpperCase()} 
                      mode={printer.mode}
                      size="small"
                    />
                    <Typography variant="h6" sx={{ 
                      color: '#00ffff',
                      mb: 1,
                      fontSize: '1rem',
                      fontWeight: 500
                    }}>
                      {printer.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
                      IP: {printer.ip}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
                      Model: {printer.model}
                    </Typography>
                    {printer.serial && (
                      <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
                        S/N: {printer.serial}
                      </Typography>
                    )}
                    {printer.version && (
                      <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
                        Version: {printer.version}
                      </Typography>
                    )}
                  </PrinterCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Manual Input Section */}
        <Typography variant="subtitle1" sx={{ 
          mt: 2, 
          mb: 1,
          color: '#00ffff',
          borderTop: '1px solid rgba(0, 255, 255, 0.1)',
          paddingTop: '20px'
        }}>
          Manual Setup:
        </Typography>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel sx={{ color: '#00ffff' }}>Printer Type</InputLabel>
          <Select
            value={newPrinter.type}
            onChange={(e) => setNewPrinter({ ...newPrinter, type: e.target.value })}
            label="Printer Type"
            sx={{ 
              color: '#00ffff',
              '& .MuiSelect-icon': { color: '#00ffff' },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(0, 255, 255, 0.5)'
              },
              '& .MuiPaper-root': {
                backgroundColor: 'rgba(0, 0, 0, 0.9)'
              }
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  bgcolor: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(0, 255, 255, 0.3)',
                  '& .MuiMenuItem-root': {
                    color: '#00ffff',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 255, 255, 0.1)'
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(0, 255, 255, 0.2)',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 255, 255, 0.3)'
                      }
                    }
                  }
                }
              }
            }}
          >
            {Object.entries(PRINTER_TYPES).map(([key, value]) => (
              <MenuItem key={key} value={key}>{value.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <NeonTextField
          autoFocus
          margin="dense"
          label="Printer Name"
          fullWidth
          value={newPrinter.name}
          onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
        />

        <NeonTextField
          margin="dense"
          label="IP Address"
          fullWidth
          value={newPrinter.ip}
          onChange={(e) => setNewPrinter({ ...newPrinter, ip: e.target.value })}
        />

        {newPrinter.type === 'BAMBULAB' && (
          <NeonTextField
            margin="dense"
            label="Access Code"
            fullWidth
            value={newPrinter.accessCode}
            onChange={(e) => setNewPrinter({ ...newPrinter, accessCode: e.target.value })}
          />
        )}
      </DialogContent>

      <DialogActions sx={{
        borderTop: '1px solid rgba(0, 255, 255, 0.1)',
        padding: 2
      }}>
        <NeonButton onClick={onClose}>
          Cancel
        </NeonButton>
        <NeonButton onClick={() => {
          const printerData = {
            ...newPrinter,
            streamUrl: newPrinter.type === 'BAMBULAB' 
              ? `rtsps://bblp:${newPrinter.accessCode}@${newPrinter.ip}:322/streaming/live/1`
              : `http://${newPrinter.ip}:8080/?action=stream`
          };
          onAdd(printerData);
        }}
          disabled={isAdding || !newPrinter.name || !newPrinter.ip || (newPrinter.type === 'BAMBULAB' && !newPrinter.accessCode)}
        >
          {isAdding ? <CircularProgress size={24} /> : 'Add'}
        </NeonButton>
      </DialogActions>
    </GlassDialog>
  );
};

export default AddPrinterDialog; 