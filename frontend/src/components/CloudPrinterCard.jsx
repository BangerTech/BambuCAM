import React, { useState, useRef, useEffect } from 'react';
import { IconButton, Box, Typography, Paper, Chip } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DeleteIcon from '@mui/icons-material/Delete';
import { Logger, LOG_CATEGORIES } from '../utils/logger';

// Status-Farben definieren (gleich wie bei PrinterCard)
const getStatusColor = (status) => {
  switch(status?.toLowerCase()) {
    case 'printing':
      return '#00ff00';
    case 'finished':
      return '#00ffff';
    case 'standby':
      return '#ffaa00';
    case 'error':
      return '#ff0000';
    default:
      return '#888888';
  }
};

const CloudPrinterCard = ({ printer, onDelete, isFullscreen, onFullscreenToggle }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(printer.id);
    } finally {
      if (isMounted.current) {
        setIsDeleting(false);
      }
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = document.fullscreenElement !== null;
      if (isFullscreen !== isCurrentlyFullscreen) {
        onFullscreenToggle(printer);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen, onFullscreenToggle, printer]);

  // Logging für Cloud Printer
  useEffect(() => {
    Logger.printer('Cloud Printer data updated:', {
      id: printer.id,
      name: printer.name,
      status: printer.online ? 'online' : 'offline',
      model: printer.model
    });
  }, [printer]);

  return (
    <Paper
      elevation={3}
      sx={{
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(10px)',
        borderRadius: '15px',
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        overflow: 'hidden',
        border: '1px solid rgba(0, 255, 255, 0.2)',
        boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)'
      }}
    >
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Header mit Name und Buttons */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '12px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#fff',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                fontSize: '1.1rem'
              }}
            >
              {printer.name}
            </Typography>
            <Chip
              label={printer.online ? "Online" : "Offline"}
              size="small"
              sx={{
                backgroundColor: printer.online ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
                color: printer.online ? '#00ff00' : '#ff0000',
                border: `1px solid ${printer.online ? '#00ff00' : '#ff0000'}`
              }}
            />
          </Box>

          <Box>
            {!isFullscreen && (
              <IconButton
                onClick={handleDelete}
                sx={{
                  color: '#ff4444',
                  '&:hover': { color: '#ff0000' }
                }}
              >
                <DeleteIcon />
              </IconButton>
            )}
            <IconButton
              onClick={() => onFullscreenToggle(printer)}
              sx={{
                color: '#00ffff',
                '&:hover': { color: '#66ffff' }
              }}
            >
              <FullscreenIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Hauptbereich mit Drucker-Informationen */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#fff'
          }}
        >
          <Typography variant="h5" sx={{ mb: 2 }}>
            {printer.model}
          </Typography>
          {printer.print_status && (
            <Typography variant="body1">
              Status: {printer.print_status}
            </Typography>
          )}
        </Box>

        {/* Footer mit zusätzlichen Informationen */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px',
            background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
            zIndex: 2
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: '#fff',
              fontSize: '0.9rem',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
            }}
          >
            Device ID: {printer.dev_id}
          </Typography>
        </Box>
      </Box>

      {/* Loading Overlay während des Löschens */}
      {isDeleting && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <Typography sx={{ color: '#fff' }}>
            Deleting...
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default CloudPrinterCard; 