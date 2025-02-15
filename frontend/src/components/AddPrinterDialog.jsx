import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel, Box, Typography, List, ListItem, ListItemText, IconButton, Collapse } from '@mui/material';
import styled from '@emotion/styled';
import InfoIcon from '@mui/icons-material/Info';

// Dynamische API URL basierend auf dem aktuellen Host
const API_URL = `http://${window.location.hostname}:4000`;

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

const NeonButton = styled(Button)({
  background: 'rgba(0, 0, 0, 0.8)',
  color: '#00ffff',
  '&:hover': {
    background: 'rgba(0, 255, 255, 0.1)',
  }
});

const NeonTextField = styled(TextField)({
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(0, 255, 255, 0.5)',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#00ffff',
  }
});

const GlassDialog = styled(Dialog)({
  '& .MuiPaper-root': {
    background: '#1e1e1e',
    color: '#00ffff',
    border: '1px solid #00ffff',
    borderRadius: '10px',
    minWidth: '400px'
  }
});

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
  const [printerType, setPrinterType] = useState('');
  const [newPrinter, setNewPrinter] = useState({
    name: '',
    ip: '',
    accessCode: '',
    type: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  console.log('Current printer type:', printerType);  // Debug-Log

  const handleTypeChange = (event) => {
    const type = event.target.value;
    console.log('Setting printer type to:', type);  // Debug-Log
    setPrinterType(type);
    setNewPrinter(prev => ({
      ...prev,
      type,
      streamUrl: '',
      accessCode: type === 'CREALITY' ? '' : prev.accessCode
    }));
  };

  const handleIpChange = (event) => {
    const ip = event.target.value;
    setNewPrinter(prev => ({
      ...prev,
      ip,
      streamUrl: printerType ? 
        PRINTER_TYPES[printerType].streamUrlTemplate
          .replace('{ip}', ip)
          .replace('{accessCode}', prev.accessCode) 
        : ''
    }));
  };

  const handleAccessCodeChange = (event) => {
    const accessCode = event.target.value;
    setNewPrinter(prev => ({
      ...prev,
      accessCode,
      streamUrl: printerType ? 
        PRINTER_TYPES[printerType].streamUrlTemplate
          .replace('{ip}', prev.ip)
          .replace('{accessCode}', accessCode) 
        : ''
    }));
  };

  const handleAddPrinter = async () => {
    try {
      setSubmitting(true);
      const printerData = {
        name: newPrinter.name,
        ip: newPrinter.ip,
        type: printerType,
        accessCode: newPrinter.accessCode || ''
      };

      console.log('Sending printer data:', printerData);

      const response = await fetch('/api/printers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(printerData)
      });

      const data = await response.json();
      console.log('Server response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add printer');
      }

      if (data.success && data.printer) {
        onAdd(data.printer);
        onClose();
      } else {
        throw new Error('Invalid server response');
      }
    } catch (error) {
      console.error('Error in handleAddPrinter:', error);
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassDialog open={open} onClose={onClose}>
      <DialogTitle sx={{ 
        borderBottom: '1px solid rgba(0,0,0,0.1)',
        pb: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Add New Printer</span>
        <IconButton
          onClick={() => setShowGuide(!showGuide)}
          title="Setup Guide"
          sx={{ color: '#00ffff' }}
        >
          <InfoIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {/* Setup Guide */}
        <Collapse in={showGuide}>
          <Box sx={{ mb: 3, mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#00ffff' }}>
              BambuLab Printer Setup:
            </Typography>
            <ol style={{ paddingLeft: '20px', color: '#00ffff' }}>
              <li>Connect the printer to your network via LAN cable</li>
              <li>Enable LAN Mode Liveview:
                <ul>
                  <li>Go to &quot;Settings&quot; (gear icon) {'->'} &quot;General&quot;</li>
                  <li>Enable &quot;LAN Mode Liveview&quot;</li>
                  <li>Note down the Access Code</li>
                </ul>
              </li>
              <li>Find the IP address under:
                <ul>
                  <li>Settings {'->'} Network {'->'} IP Address</li>
                </ul>
              </li>
              <li>Click &quot;Scan Network&quot; or enter the IP manually</li>
            </ol>
          </Box>
        </Collapse>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Drucker-Typ Auswahl */}
          <FormControl fullWidth>
            <InputLabel sx={{ color: '#00ffff' }}>Printer Type</InputLabel>
            <Select
              value={printerType}
              onChange={handleTypeChange}
              sx={{
                color: '#00ffff',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 255, 255, 0.3)'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 255, 255, 0.5)'
                }
              }}
            >
              {Object.entries(PRINTER_TYPES).map(([key, value]) => (
                <MenuItem key={key} value={key}>{value.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* SCAN NETWORK Button */}
          <Button
            variant="contained"
            onClick={onScan}
            disabled={isScanning}
            sx={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#00ffff',
              border: '2px solid #00ffff',
              borderRadius: '25px',
              padding: '10px 20px',
              '&:hover': {
                background: 'rgba(0, 255, 255, 0.1)',
              }
            }}
          >
            {isScanning ? `Scanning... (${scanTimer}s)` : 'SCAN NETWORK'}
          </Button>

          {/* Gefundene Drucker */}
          {scannedPrinters.length > 0 && (
            <List>
              {scannedPrinters.map((printer) => (
                <ListItem 
                  key={printer.ip}
                  button
                  onClick={() => setNewPrinter({
                    ...newPrinter,
                    name: printer.name,
                    ip: printer.ip
                  })}
                  sx={{
                    border: '1px solid rgba(0, 255, 255, 0.3)',
                    borderRadius: '4px',
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'rgba(0, 255, 255, 0.1)'
                    }
                  }}
                >
                  <ListItemText 
                    primary={printer.name}
                    secondary={printer.ip}
                    sx={{
                      '& .MuiListItemText-primary': { color: '#00ffff' },
                      '& .MuiListItemText-secondary': { color: 'rgba(0, 255, 255, 0.7)' }
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}

          {/* Manuelle Eingabe */}
          <NeonTextField
            label="Printer Name"
            value={newPrinter.name}
            onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
            fullWidth
          />
          
          <NeonTextField
            label="IP Address"
            value={newPrinter.ip}
            onChange={(e) => setNewPrinter({ ...newPrinter, ip: e.target.value })}
            fullWidth
          />

          {/* Access Code nur für Bambu Lab */}
          {printerType === 'BAMBULAB' && (
            <NeonTextField
              label="Access Code"
              value={newPrinter.accessCode}
              onChange={(e) => setNewPrinter({ ...newPrinter, accessCode: e.target.value })}
              fullWidth
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <NeonButton onClick={onClose}>CANCEL</NeonButton>
        <NeonButton 
          onClick={handleAddPrinter}
          disabled={submitting || !newPrinter.name || !newPrinter.ip || 
                   (printerType === 'BAMBULAB' && !newPrinter.accessCode) ||
                   !printerType}
        >
          {submitting ? 'ADDING...' : 'ADD'}
        </NeonButton>
      </DialogActions>
      {error && (
        <Box sx={{ p: 2, color: 'error.main' }}>
          {error}
        </Box>
      )}
    </GlassDialog>
  );
};

export default AddPrinterDialog; 