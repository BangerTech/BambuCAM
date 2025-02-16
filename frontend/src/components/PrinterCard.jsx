import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardContent, IconButton, Box, Typography, LinearProgress, Chip, CircularProgress } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import DeleteIcon from '@mui/icons-material/Delete';
import RTSPStream from './RTSPStream';
import BambuLabInfo from './BambuLabInfo';
import CrealityInfo from './CrealityInfo';
import GenericInfo from './GenericInfo';
import logger from '../utils/logger';

const PrinterCard = ({ printer, onDelete }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const cardRef = useRef(null);

  const handleFullscreenClick = () => {
    setIsFullscreen(prev => !prev);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(printer.id);
    } finally {
      setIsDeleting(false);
    }
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

  useEffect(() => {
    logger.printer('Printer data updated:', {
      id: printer.id,
      name: printer.name,
      status: printer.status,
      temps: printer.temperatures,
      state: printer.state
    });
  }, [printer]);

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

  // Drucker-spezifische Rendering Logik
  const renderPrinterInfo = () => {
    logger.debug('Rendering printer info:', {
      type: printer.type,
      temps: printer.temperatures,
      state: printer.state
    });
    
    const infoStyle = {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 10
    };
    
    switch(printer.type) {
      case 'BAMBULAB':
        return <Box sx={infoStyle}><BambuLabInfo printer={printer} /></Box>;
      case 'CREALITY':
        return <Box sx={infoStyle}><CrealityInfo printer={printer} /></Box>;
      default:
        return null;
    }
  };

  // Temperaturanzeige
  const renderTemperatures = () => {
    const temps = printer.temperatures || {};
    const targets = printer.targets || {};
    
    // Unterschiedliches Rendering je nach Druckertyp
    if (printer.type === 'BAMBULAB') {
      // Original Bambulab-Anzeige beibehalten
      return (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Nozzle: {temps.nozzle || 0}°C
            {targets.nozzle > 0 && ` / ${targets.nozzle}°C`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bed: {temps.bed || 0}°C
            {targets.bed > 0 && ` / ${targets.bed}°C`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chamber: {temps.chamber || 0}°C
          </Typography>
        </Box>
      );
    }
    
    // Neue Creality-Anzeige
    if (printer.type === 'CREALITY') {
      return (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#00ffff' }}>
            Hotend: {temps.hotend?.toFixed(1) || '0.0'}°C
            {targets.hotend > 0 && ` / ${targets.hotend}°C`}
          </Typography>
          <Typography variant="body2" sx={{ color: '#00ffff' }}>
            Bed: {temps.bed?.toFixed(1) || '0.0'}°C
            {targets.bed > 0 && ` / ${targets.bed}°C`}
          </Typography>
          {temps.chamber !== undefined && (
            <Typography variant="body2" sx={{ color: '#00ffff' }}>
              Chamber: {temps.chamber?.toFixed(1) || '0.0'}°C
            </Typography>
          )}
        </Box>
      );
    }
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
            <IconButton onClick={handleDelete} sx={{ color: '#00ffff' }}>
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
          {renderPrinterInfo()}
        </Box>
        {isDeleting && (
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            zIndex: 9999
          }}>
            <CircularProgress sx={{ color: '#00ffff' }} />
            <Typography color="#00ffff">
              Deleting printer...
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default PrinterCard; 