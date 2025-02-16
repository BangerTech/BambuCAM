import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel, Box, Typography, List, ListItem, ListItemText, IconButton, Collapse } from '@mui/material';
import styled from '@emotion/styled';
import InfoIcon from '@mui/icons-material/Info';
import logger from '../utils/logger';
import SearchIcon from '@mui/icons-material/Search';
import { Alert } from '@mui/material';

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

  const handleTypeChange = (event) => {
    const type = event.target.value;
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
      
      // Übergebe die Daten an den Parent ohne API-Call
      onAdd(printerData);
      onClose();
      
    } catch (error) {
      console.error('Error in handleAddPrinter:', error);
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleScan = async () => {
    try {
      setIsScanning(true);
      logger.info('Starting network scan...');
      const response = await fetch(`${API_URL}/scan`);
      const data = await response.json();
      logger.info('Scan results:', data);
      setScannedPrinters(data.printers);
    } catch (error) {
      logger.error('Scan error:', error);
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

        {/* Scan Button zuerst */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
          <NeonButton
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
          </NeonButton>
        </Box>

        {/* Dropdown Menü an zweiter Stelle */}
        <FormControl fullWidth sx={{ mb: 2 }}>
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

        {/* Eingabefelder an dritter Stelle */}
        <TextField
          autoFocus
          margin="dense"
          label="Printer Name"
          fullWidth
          value={newPrinter.name}
          onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
        />
        <TextField
          margin="dense"
          label="IP Address"
          fullWidth
          value={newPrinter.ip}
          onChange={(e) => setNewPrinter({ ...newPrinter, ip: e.target.value })}
        />
        {printerType === 'BAMBULAB' && (
          <TextField
            margin="dense"
            label="Access Code"
            fullWidth
            value={newPrinter.accessCode}
            onChange={(e) => setNewPrinter({ ...newPrinter, accessCode: e.target.value })}
          />
        )}

        {/* Rest bleibt gleich */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {scannedPrinters.length > 0 && (
          <List>
            {scannedPrinters.map((printer, index) => (
              <ListItem
                key={index}
                button
                onClick={() => setNewPrinter({
                  ...newPrinter,
                  name: printer.name,
                  ip: printer.ip
                })}
              >
                <ListItemText
                  primary={`${printer.name} (${printer.ip})`}
                  secondary={`Type: ${printer.type}`}
                />
              </ListItem>
            ))}
          </List>
        )}
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
    </GlassDialog>
  );
};

export default AddPrinterDialog; 