import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel, Box, Typography, List, ListItem, ListItemText, IconButton, Collapse } from '@mui/material';
import styled from '@emotion/styled';
import InfoIcon from '@mui/icons-material/Info';
import { CircularProgress } from '@mui/material';

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
        >
          <InfoIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
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
        <button 
          className="neon-scan-button"
          onClick={onScan}
          disabled={isScanning}
        >
          {isScanning ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
              Scanning... ({scanTimer}s)
            </>
          ) : (
            'Scan Network'
          )}
        </button>

        {/* Found Printers */}
        {scannedPrinters.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Found Printers:
            </Typography>
            <List>
              {scannedPrinters.map((printer) => (
                <ListItem 
                  key={printer.id || printer.ip}
                  button
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 1
                  }}
                  onClick={() => handleScannedPrinterSelect(printer)}
                >
                  <ListItemText 
                    primary={printer.name}
                    secondary={`${printer.ip} (${printer.model})`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Manual Input */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Printer Type</InputLabel>
          <Select
            value={newPrinter.type}
            onChange={(e) => setNewPrinter({ ...newPrinter, type: e.target.value })}
            label="Printer Type"
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

      <DialogActions sx={{ padding: '16px 24px' }}>
        <Button 
          onClick={onClose}
          disabled={isAdding}
          sx={{
            color: '#00ffff',
            '&:hover': {
              background: 'rgba(0, 255, 255, 0.1)',
            },
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={() => {
            const printerData = {
              ...newPrinter,
              streamUrl: newPrinter.type === 'BAMBULAB' 
                ? `rtsps://bblp:${newPrinter.accessCode}@${newPrinter.ip}:322/streaming/live/1`
                : `http://${newPrinter.ip}:8080/?action=stream`
            };
            onAdd(printerData);
          }}
          disabled={isAdding || !newPrinter.name || !newPrinter.ip || (newPrinter.type === 'BAMBULAB' && !newPrinter.accessCode)}
          variant="contained"
          sx={{
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#00ffff',
            border: '1px solid #00ffff',
            '&:hover': {
              background: 'rgba(0, 255, 255, 0.1)',
            },
            '&.Mui-disabled': {
              background: 'rgba(0, 0, 0, 0.3)',
              color: 'rgba(0, 255, 255, 0.3)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
            },
          }}
        >
          Add
        </Button>
      </DialogActions>
    </GlassDialog>
  );
};

export default AddPrinterDialog; 