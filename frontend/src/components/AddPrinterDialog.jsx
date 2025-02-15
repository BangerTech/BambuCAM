import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel, Box, Typography } from '@mui/material';

const PRINTER_TYPES = {
  BAMBULAB: {
    name: 'Bambu Lab',
    models: ['X1C', 'P1S', 'P1P', 'A1', 'A1 Mini'],
    streamUrlTemplate: 'rtsp://{ip}:8554/streaming/live/1',
  },
  CREALITY: {
    name: 'Creality',
    models: ['K1', 'K1 Max', 'K1 Pro', 'K2 Plus'],
    streamUrlTemplate: 'http://{ip}:8080/?action=stream',
  },
  CUSTOM: {
    name: 'Custom / Other',
    models: ['Generic RTSP', 'Generic MJPEG'],
    streamUrlTemplate: '',
  }
};

const AddPrinterDialog = ({ open, onClose, onAdd, isAdding }) => {
  const [printerType, setPrinterType] = useState('');
  const [printerModel, setPrinterModel] = useState('');
  const [newPrinter, setNewPrinter] = useState({
    name: '',
    ip: '',
    accessCode: '',
    streamUrl: '',
    type: '',
    model: ''
  });

  const handleTypeChange = (event) => {
    const type = event.target.value;
    setPrinterType(type);
    setPrinterModel('');
    setNewPrinter(prev => ({
      ...prev,
      type,
      streamUrl: '',
      accessCode: type === 'CREALITY' ? '' : prev.accessCode // Creality braucht keinen Access Code
    }));
  };

  const handleModelChange = (event) => {
    const model = event.target.value;
    setPrinterModel(model);
    setNewPrinter(prev => ({
      ...prev,
      model,
      streamUrl: PRINTER_TYPES[printerType].streamUrlTemplate.replace('{ip}', prev.ip)
    }));
  };

  const handleIpChange = (event) => {
    const ip = event.target.value;
    setNewPrinter(prev => ({
      ...prev,
      ip,
      streamUrl: printerType ? PRINTER_TYPES[printerType].streamUrlTemplate.replace('{ip}', ip) : ''
    }));
  };

  const handleSubmit = () => {
    onAdd(newPrinter);
  };

  const handleClose = () => {
    setPrinterType('');
    setPrinterModel('');
    setNewPrinter({
      name: '',
      ip: '',
      accessCode: '',
      streamUrl: '',
      type: '',
      model: ''
    });
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      PaperProps={{
        sx: {
          background: '#1e1e1e',
          color: '#00ffff',
          border: '1px solid #00ffff',
          borderRadius: '10px',
          minWidth: '400px'
        }
      }}
    >
      <DialogTitle>Add New Printer</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Printer Type Selection */}
          <FormControl fullWidth>
            <InputLabel sx={{ color: '#00ffff' }}>Printer Type</InputLabel>
            <Select
              value={printerType}
              onChange={handleTypeChange}
              sx={{
                color: '#00ffff',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#00ffff'
                }
              }}
            >
              {Object.entries(PRINTER_TYPES).map(([key, value]) => (
                <MenuItem key={key} value={key}>{value.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Printer Model Selection - nur anzeigen wenn Typ ausgewählt */}
          {printerType && (
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#00ffff' }}>Printer Model</InputLabel>
              <Select
                value={printerModel}
                onChange={handleModelChange}
                sx={{
                  color: '#00ffff',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#00ffff'
                  }
                }}
              >
                {PRINTER_TYPES[printerType].models.map((model) => (
                  <MenuItem key={model} value={model}>{model}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Basis Felder */}
          <TextField
            label="Printer Name"
            value={newPrinter.name}
            onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
            fullWidth
            sx={{ input: { color: '#00ffff' } }}
          />
          
          <TextField
            label="IP Address"
            value={newPrinter.ip}
            onChange={handleIpChange}
            fullWidth
            sx={{ input: { color: '#00ffff' } }}
          />

          {/* Access Code nur für Bambu Lab */}
          {printerType === 'BAMBULAB' && (
            <TextField
              label="Access Code"
              value={newPrinter.accessCode}
              onChange={(e) => setNewPrinter({ ...newPrinter, accessCode: e.target.value })}
              fullWidth
              sx={{ input: { color: '#00ffff' } }}
            />
          )}

          {/* Custom Stream URL für Custom/Other */}
          {printerType === 'CUSTOM' && (
            <TextField
              label="Stream URL"
              value={newPrinter.streamUrl}
              onChange={(e) => setNewPrinter({ ...newPrinter, streamUrl: e.target.value })}
              fullWidth
              sx={{ input: { color: '#00ffff' } }}
              helperText="Enter complete stream URL (e.g., rtsp://... or http://...)"
            />
          )}

          {/* Preview der generierten Stream URL */}
          {newPrinter.streamUrl && printerType !== 'CUSTOM' && (
            <Typography variant="body2" sx={{ color: '#00ffff' }}>
              Stream URL: {newPrinter.streamUrl}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} sx={{ color: '#00ffff' }}>Cancel</Button>
        <Button 
          onClick={handleSubmit}
          disabled={isAdding || !newPrinter.name || !newPrinter.ip || 
                   (printerType === 'BAMBULAB' && !newPrinter.accessCode) ||
                   !printerType || !printerModel}
          variant="contained"
          sx={{
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#00ffff',
            '&:hover': {
              background: 'rgba(0, 255, 255, 0.1)',
            }
          }}
        >
          Add Printer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddPrinterDialog; 