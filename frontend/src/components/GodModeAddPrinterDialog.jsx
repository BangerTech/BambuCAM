import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, Box, CircularProgress, 
  List, ListItem, ListItemText, ListItemSecondaryAction, 
  IconButton, Typography, Tabs, Tab, Divider, Button,
  Tooltip, TextField, FormControl, InputLabel, Select, MenuItem,
  Paper, Grid
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import styled from '@emotion/styled';
import { API_URL } from '../config';
import SearchIcon from '@mui/icons-material/Search';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    background: 'rgba(0, 0, 0, 0.9)',
    backdropFilter: 'blur(10px)',
    border: '2px solid #00ffff',
    borderRadius: '15px',
    boxShadow: '0 0 30px rgba(0, 255, 255, 0.4)',
    color: '#00ffff',
    minWidth: '500px',
    maxWidth: '800px',
    animation: 'godModeEntrance 0.5s ease-out',
  },
  '@keyframes godModeEntrance': {
    '0%': {
      transform: 'scale(0.9)',
      opacity: 0,
    },
    '100%': {
      transform: 'scale(1)',
      opacity: 1,
    }
  }
}));

const GodModeAddPrinterDialog = ({ open, onClose, onAdd, printers }) => {
  const [scanning, setScanning] = useState(false);
  const [scannedPrinters, setScannedPrinters] = useState({ lan: [], cloud: [] });
  const [activeTab, setActiveTab] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [manualPrinter, setManualPrinter] = useState({
    name: '',
    ip: '',
    type: 'BAMBULAB',
    accessCode: ''
  });
  
  const startScan = async () => {
    setScanning(true);
    setScanProgress(0);
    
    try {
      // Progress-Simulation
      const progressInterval = setInterval(() => {
        setScanProgress(prev => Math.min(prev + 2, 95));
      }, 100);

      // Starte beide Scans parallel
      const [lanResponse, cloudResponse] = await Promise.all([
        fetch(`${API_URL}/api/godmode/scan`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('cloudToken')}`
          }
        }),
        fetch(`${API_URL}/cloud/printers`)
      ]);
      
      const lanData = await lanResponse.json();
      const cloudData = await cloudResponse.json();
      
      clearInterval(progressInterval);
      setScanProgress(100);
      
      setScannedPrinters({
        lan: lanData.printers || [],
        cloud: cloudData.devices || []
      });
    } catch (error) {
      console.error('God Mode Scan failed:', error);
    } finally {
      setScanning(false);
    }
  };

  const handleAddPrinter = (printer, type) => {
    onAdd({ ...printer, isCloud: type === 'cloud' });
  };

  const handleManualAdd = () => {
    const printerData = {
      ...manualPrinter,
      streamUrl: manualPrinter.type === 'BAMBULAB' 
        ? `rtsps://bblp:${manualPrinter.accessCode}@${manualPrinter.ip}:322/streaming/live/1`
        : `http://${manualPrinter.ip}:8080/?action=stream`
    };
    
    handleAddPrinter(printerData, 'lan');
    setManualPrinter({
      name: '',
      ip: '',
      type: 'BAMBULAB',
      accessCode: ''
    });
  };

  const textFieldStyle = {
    '& .MuiOutlinedInput-root': {
      '& fieldset': { borderColor: '#00ffff' },
      '&:hover fieldset': { borderColor: '#00ffff' },
      '&.Mui-focused fieldset': { borderColor: '#00ffff' }
    },
    '& .MuiInputLabel-root': { color: '#00ffff' },
    '& .MuiInputBase-input': { color: '#00ffff' }
  };

  const buttonStyle = {
    color: '#00ffff',
    borderColor: '#00ffff',
    '&:hover': {
      borderColor: '#00ffff',
      backgroundColor: 'rgba(0, 255, 255, 0.1)'
    }
  };

  return (
    <StyledDialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid #00ffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography component="div" variant="h6">God Mode Printer Discovery</Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ width: '100%', mb: 2 }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, v) => setActiveTab(v)}
            sx={{
              '& .MuiTab-root': { color: '#00ffff' },
              '& .Mui-selected': { color: '#00ffff !important' },
              '& .MuiTabs-indicator': { backgroundColor: '#00ffff' }
            }}
          >
            <Tab label="LAN PRINTERS" />
            <Tab label="CLOUD PRINTERS" />
          </Tabs>
        </Box>

        {scanning && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            p: 3,
            background: 'rgba(0, 255, 255, 0.05)',
            borderRadius: '10px',
            border: '1px solid rgba(0, 255, 255, 0.1)'
          }}>
            <CircularProgress 
              variant="determinate" 
              value={scanProgress} 
              sx={{ color: '#00ffff', mb: 2 }} 
            />
            <Typography sx={{ color: '#00ffff' }}>
              Scanning network... {scanProgress}%
            </Typography>
          </Box>
        )}

        {activeTab === 0 && !scanning && (
          <Box>
            <Paper sx={{
              p: 2,
              mb: 3,
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(0, 255, 255, 0.2)',
              borderRadius: '10px'
            }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#00ffff' }}>
                Manual Add
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth sx={textFieldStyle}>
                    <InputLabel>Printer Type</InputLabel>
                    <Select
                      value={manualPrinter.type}
                      onChange={(e) => setManualPrinter(prev => ({ ...prev, type: e.target.value }))}
                      label="Printer Type"
                    >
                      <MenuItem value="BAMBULAB">Bambu Lab</MenuItem>
                      <MenuItem value="CREALITY">Creality</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {manualPrinter.type === 'BAMBULAB' && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Access Code"
                      value={manualPrinter.accessCode}
                      onChange={(e) => setManualPrinter(prev => ({ ...prev, accessCode: e.target.value }))}
                      sx={textFieldStyle}
                    />
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={manualPrinter.name}
                    onChange={(e) => setManualPrinter(prev => ({ ...prev, name: e.target.value }))}
                    sx={textFieldStyle}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="IP Address"
                    value={manualPrinter.ip}
                    onChange={(e) => setManualPrinter(prev => ({ ...prev, ip: e.target.value }))}
                    sx={textFieldStyle}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    onClick={handleManualAdd}
                    disabled={!manualPrinter.name || !manualPrinter.ip || 
                      (manualPrinter.type === 'BAMBULAB' && !manualPrinter.accessCode)}
                    sx={buttonStyle}
                  >
                    Add Printer
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{
              p: 2,
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(0, 255, 255, 0.2)',
              borderRadius: '10px'
            }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2 
              }}>
                <Typography variant="h6" sx={{ color: '#00ffff' }}>
                  Network Scan
                </Typography>
                <Button
                  variant="outlined"
                  onClick={startScan}
                  disabled={scanning}
                  startIcon={<SearchIcon />}
                  sx={buttonStyle}
                >
                  Scan Network
                </Button>
              </Box>

              <List>
                {scannedPrinters.lan?.map((printer) => (
                  <ListItem 
                    key={printer.id}
                    sx={{
                      border: '1px solid rgba(0, 255, 255, 0.1)',
                      borderRadius: '8px',
                      mb: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(0, 255, 255, 0.05)'
                      }
                    }}
                  >
                    <ListItemText 
                      primary={printer.name}
                      secondary={printer.ip}
                      sx={{ color: '#00ffff' }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        onClick={() => handleAddPrinter(printer, 'lan')}
                        sx={{ color: '#00ffff' }}
                      >
                        <AddIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        )}

        {activeTab === 1 && !scanning && (
          <Paper sx={{
            p: 2,
            background: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(0, 255, 255, 0.2)',
            borderRadius: '10px'
          }}>
            <List>
              {scannedPrinters.cloud?.map((printer) => (
                <ListItem 
                  key={printer.id}
                  sx={{
                    border: '1px solid rgba(0, 255, 255, 0.1)',
                    borderRadius: '8px',
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'rgba(0, 255, 255, 0.05)'
                    }
                  }}
                >
                  <ListItemText 
                    primary={printer.name}
                    secondary={`Device ID: ${printer.dev_id}`}
                    sx={{ color: '#00ffff' }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      onClick={() => handleAddPrinter(printer, 'cloud')}
                      sx={{ color: '#00ffff' }}
                    >
                      <AddIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </DialogContent>
    </StyledDialog>
  );
};

export default GodModeAddPrinterDialog;