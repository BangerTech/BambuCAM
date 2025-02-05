import React from 'react';
import { Dialog, IconButton, Box, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RTSPStream from './RTSPStream';

const FullscreenDialog = ({ printer, open, onClose, getTemperature }) => {
  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          backgroundColor: '#000',
          height: '100vh'
        }
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 16,
          top: 16,
          color: 'white',
          zIndex: 3,
          background: 'rgba(0,0,0,0.5)',
          '&:hover': {
            background: 'rgba(0,0,0,0.7)'
          }
        }}
      >
        <CloseIcon />
      </IconButton>

      {printer && (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Video Container */}
          <Box sx={{ 
            flex: 1, 
            position: 'relative', 
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000'
          }}>
            <RTSPStream
              url={printer.streamUrl}
              wsPort={printer.wsPort}
              key={`fullscreen-${printer.id}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
              autoPlay
              playsInline
              controls
            />
          </Box>

          {/* Status Bar */}
          <Box sx={{
            padding: '20px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white'
          }}>
            <Typography variant="h6">{printer.name}</Typography>
            <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
              <Typography>
                Hotend: {getTemperature(printer, 'nozzle')}°C
              </Typography>
              <Typography>
                Bed: {getTemperature(printer, 'bed')}°C
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Dialog>
  );
};

export default FullscreenDialog; 