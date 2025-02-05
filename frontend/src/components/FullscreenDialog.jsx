import React, { useEffect } from 'react';
import { Dialog, IconButton, Box, Typography, AppBar, Toolbar, LinearProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RTSPStream from './RTSPStream';

const FullscreenDialog = ({ printer, open, onClose, getTemperature, printerStatus }) => {
  useEffect(() => {
    if (open && printer) {
      const video = document.querySelector('.fullscreen-video');
      if (video) {
        video.play();
      }
    }
  }, [open, printer]);

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          background: '#000',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          boxShadow: '0 0 2rem rgba(0, 255, 255, 0.2)',
        }
      }}
    >
      <AppBar sx={{ position: 'relative', background: 'rgba(0,0,0,0.7)' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2, flex: 1 }}>
            {printer?.name}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ height: '100%', position: 'relative' }}>
        <RTSPStream 
          printer={printer} 
          fullscreen 
          url={printer?.streamUrl}
          wsPort={printer?.wsPort || 9000}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
          autoPlay
          playsInline
          muted
          className="fullscreen-video"
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
    </Dialog>
  );
};

export default FullscreenDialog; 