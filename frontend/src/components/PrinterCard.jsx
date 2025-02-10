import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardContent, IconButton, Box, Typography, LinearProgress, Chip } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import DeleteIcon from '@mui/icons-material/Delete';
import RTSPStream from './RTSPStream';

const PrinterCard = ({ printer, onRemove }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cardRef = useRef(null);

  const handleFullscreenClick = () => {
    setIsFullscreen(prev => !prev);
  };

  // Höre auf Fullscreen-Änderungen vom Browser
  useEffect(() => {
    const handleFullscreenChange = () => {
      // Nur setzen wenn sich der Status wirklich geändert hat
      const isCurrentlyFullscreen = document.fullscreenElement !== null;
      if (isFullscreen !== isCurrentlyFullscreen) {
        setIsFullscreen(isCurrentlyFullscreen);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen]);

  const cardStyle = isFullscreen ? {
    position: 'fixed',
    top: '20px',
    left: '20px',
    right: '20px',
    maxHeight: 'calc(100vh - 40px)',
    background: '#1e1e1e',
    zIndex: 1300,
    display: 'flex',
    flexDirection: 'column'
  } : {};

  const headerStyle = {
    background: '#1e1e1e',
    color: '#00ffff',
    '& .MuiCardHeader-subheader': {
      color: '#00ffff'
    }
  };

  const videoContainerStyle = {
    width: '100%',
    aspectRatio: '16/9',
    position: 'relative',
    backgroundColor: '#000'
  };

  const statusStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '8px',
    background: 'rgba(0, 0, 0, 0.7)',
    color: '#00ffff',
    textAlign: 'center'
  };

  return (
    <Card ref={cardRef} sx={cardStyle}>
      <CardHeader
        sx={headerStyle}
        action={
          <div>
            <IconButton onClick={handleFullscreenClick} sx={{ color: '#00ffff' }}>
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
            <IconButton onClick={() => onRemove(printer.id)} sx={{ color: '#00ffff' }}>
              <DeleteIcon />
            </IconButton>
          </div>
        }
        title={printer.name || 'Unnamed Printer'}
        subheader={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {printer.ip}
            </Typography>
            <Chip 
              size="small"
              label={printer.type}
              color={printer.type === 'CLOUD' ? 'primary' : 'default'}
            />
          </Box>
        }
      />
      <CardContent sx={{ p: 0, flex: 1 }}>
        <Box sx={videoContainerStyle}>
          <RTSPStream 
            printer={printer} 
            fullscreen={isFullscreen} 
            key={`${printer.id}-${isFullscreen}`}
          />
          <Box sx={statusStyle}>
            <Typography variant="body2" sx={{ mb: printer.progress ? 1 : 0 }}>
              Status: {printer.status || 'connecting'} | 
              Nozzle: {printer.temperatures?.nozzle || 0}°C | 
              Bed: {printer.temperatures?.bed || 0}°C | 
              Chamber: {printer.temperatures?.chamber || 0}°C
            </Typography>
            {printer.progress > 0 && (
              <>
                <LinearProgress 
                  variant="determinate" 
                  value={printer.progress} 
                  sx={{
                    backgroundColor: 'rgba(0, 255, 255, 0.2)',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#00ffff'
                    }
                  }}
                />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Progress: {printer.progress}%
                  {printer.remaining_time && ` | Remaining: ${printer.remaining_time}min`}
                </Typography>
              </>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PrinterCard; 