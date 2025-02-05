import React from 'react';
import { Dialog, IconButton, Box, Typography, AppBar, Toolbar, LinearProgress, Paper } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RTSPStream from './RTSPStream';

// Dynamische API URL basierend auf dem aktuellen Host
const API_URL = `http://${window.location.hostname}:4000`;

const FullscreenDialog = ({ printer, open, onClose, getTemperature, printerStatus }) => {
  // Starte den Stream wenn der Dialog geöffnet wird
  React.useEffect(() => {
    if (open && printer) {
      const startStream = async () => {
        try {
          const wsUrl = `ws://${window.location.hostname}:9000/stream/${printer.id}`;
          console.log('Starting fullscreen stream:', wsUrl);
        } catch (e) {
          console.warn('Error starting fullscreen stream:', e);
        }
      };
      startStream();
    }
  }, [open, printer]);

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={() => {
        // Cleanup beim Schließen
        if (printer) {
          console.log('Closing fullscreen stream');
        }
        onClose();
      }}
      PaperProps={{
        sx: {
          background: '#1a1a1a',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          boxShadow: '0 0 2rem rgba(0, 255, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          padding: '2rem'
        }
      }}
    >
      <Paper 
        sx={{ 
          flex: 1,
          background: '#000',
          borderRadius: '1rem',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <AppBar 
          position="relative" 
          sx={{ 
            background: 'rgba(0,0,0,0.7)',
            boxShadow: 'none'
          }}
        >
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={onClose}>
              <CloseIcon />
            </IconButton>
            <Typography variant="h6" sx={{ ml: 2, flex: 1 }}>
              {printer?.name}
            </Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, position: 'relative' }}>
          <RTSPStream 
            printer={printer} 
            fullscreen 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              background: '#000'
            }}
            autoPlay
            playsInline
            muted
          />
          
          {/* Status Overlay */}
          <Box sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '20px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography>
                Hotend: {getTemperature(printer, 'nozzle')}°C
              </Typography>
              <Typography>
                Bed: {getTemperature(printer, 'bed')}°C
              </Typography>
              <Typography>
                Chamber: {getTemperature(printer, 'chamber')}°C
              </Typography>
            </Box>
            
            <Box sx={{ mt: 2 }}>
              <LinearProgress 
                variant="determinate"
                value={printerStatus[printer?.id]?.progress || 0}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#4caf50'
                  }
                }}
              />
              <Typography sx={{ mt: 1, textAlign: 'center' }}>
                {printerStatus[printer?.id]?.remaining_time || 0} min remaining
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Dialog>
  );
};

export default FullscreenDialog; 