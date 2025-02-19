import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, Box, CircularProgress, 
  List, ListItem, ListItemText, ListItemSecondaryAction, 
  IconButton, Typography, Tabs, Tab, Divider, Button,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import styled from '@emotion/styled';
import { API_URL } from '../config';

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

const GodModeAddPrinterDialog = ({ open, onClose, onAdd }) => {
  const [scanning, setScanning] = useState(false);
  const [printers, setPrinters] = useState({ lan: [], cloud: [] });
  const [activeTab, setActiveTab] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  
  const startScan = async () => {
    setScanning(true);
    setScanProgress(0);
    
    try {
      // Progress-Simulation
      const progressInterval = setInterval(() => {
        setScanProgress(prev => Math.min(prev + 2, 95));
      }, 100);

      const response = await fetch(`${API_URL}/godmode/scan`);
      const data = await response.json();
      
      clearInterval(progressInterval);
      setScanProgress(100);
      
      setPrinters(data);
    } catch (error) {
      console.error('God Mode Scan failed:', error);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (open) {
      startScan();
    }
  }, [open]);

  const handleAddPrinter = (printer, type) => {
    onAdd({ ...printer, isCloud: type === 'cloud' });
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
        <Typography variant="h6">God Mode Printer Discovery</Typography>
        <Tooltip title="Rescan">
          <IconButton 
            onClick={startScan}
            disabled={scanning}
            sx={{ color: '#00ffff' }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      <DialogContent>
        {scanning ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            p: 3 
          }}>
            <CircularProgress 
              variant="determinate" 
              value={scanProgress} 
              sx={{ color: '#00ffff', mb: 2 }} 
            />
            <Typography>
              Scanning for printers... {scanProgress}%
            </Typography>
          </Box>
        ) : (
          <Box>
            <Tabs 
              value={activeTab} 
              onChange={(e, v) => setActiveTab(v)}
              sx={{
                '& .MuiTab-root': { color: '#00ffff' },
                '& .Mui-selected': { color: '#00ffff !important' },
                '& .MuiTabs-indicator': { backgroundColor: '#00ffff' }
              }}
            >
              <Tab label="LAN Printers" />
              <Tab label="Cloud Printers" />
            </Tabs>

            <Box sx={{ mt: 2 }}>
              {activeTab === 0 ? (
                <List>
                  {printers.lan.map((printer) => (
                    <ListItem 
                      key={printer.id}
                      sx={{
                        border: '1px solid rgba(0, 255, 255, 0.2)',
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
              ) : (
                <List>
                  {printers.cloud.map((printer) => (
                    <ListItem 
                      key={printer.id}
                      sx={{
                        border: '1px solid rgba(0, 255, 255, 0.2)',
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
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
    </StyledDialog>
  );
};

export default GodModeAddPrinterDialog;