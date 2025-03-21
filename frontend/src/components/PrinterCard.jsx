import React, { useState, useRef, useEffect } from 'react';
import { IconButton, Box, Typography, Paper, Grid, Chip, Button } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DeleteIcon from '@mui/icons-material/Delete';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import RTSPStream from './RTSPStream';
import { Logger, LOG_CATEGORIES } from '../utils/logger';
import { API_URL } from '../config';
import EmergencyStopDialog from './EmergencyStopDialog';
import axios from 'axios';

// Status-Farben definieren
const getStatusColor = (status) => {
  switch(status?.toLowerCase()) {
    case 'printing':
      return '#00ff00';  // Grün
    case 'finished':
      return '#00ffff';  // Cyan
    case 'standby':
      return '#ffaa00';  // Orange
    case 'error':
      return '#ff0000';  // Rot
    default:
      return '#888888';  // Grau für offline/unbekannt
  }
};

const PrinterCard = ({ printer, onDelete, isFullscreen, onFullscreenToggle }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEmergencyStopping, setIsEmergencyStopping] = useState(false);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const isMounted = useRef(true);  // Referenz um zu prüfen ob die Komponente mounted ist
  const videoRef = useRef(null);
  const streamRef = useRef(null); // Referenz für die Stream-Verbindung

  // Cleanup beim Unmounting
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
      // Nur State updaten wenn die Komponente noch mounted ist
      if (isMounted.current) {
        setIsDeleting(false);
      }
    }
  };

  const handleEmergencyStop = async () => {
    setShowEmergencyDialog(true);
  };

  const confirmEmergencyStop = async () => {
    setShowEmergencyDialog(false);
    setIsEmergencyStopping(true);
    try {
      const response = await fetch(`${API_URL}/printers/${printer.id}/emergency_stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        Logger.printer('Emergency stop successful', { printer: printer.id });
        // Success alert removed
      } else {
        Logger.printer('Emergency stop failed', { printer: printer.id, error: result.error || result.message });
        alert(`Error during emergency stop: ${result.error || result.message}`);
      }
    } catch (error) {
      Logger.printer('Emergency stop error', { printer: printer.id, error });
      alert(`Error during emergency stop: ${error.message}`);
    } finally {
      setIsEmergencyStopping(false);
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

  useEffect(() => {
    Logger.printer('Printer data updated:', {
      id: printer.id,
      name: printer.name,
      status: printer.status,
      temps: printer.temps || printer.temperatures,
      state: printer.state
    });
    
    // Log temperature data for debugging
    Logger.printer('Temperature data:', {
      temps: printer.temps,
      temperatures: printer.temperatures,
      type: printer.type
    });
  }, [printer]);

  useEffect(() => {
    if (printer.type === 'BAMBULAB' && videoRef.current) {
      // Wenn bereits ein Stream existiert, nicht neu verbinden
      if (streamRef.current) {
        return;
      }

      const videoUrl = `/go2rtc/stream.html?src=${encodeURIComponent(printer.streamUrl)}`;
      videoRef.current.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.src = videoUrl;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      videoRef.current.appendChild(iframe);
      streamRef.current = iframe;
      
      // Cleanup beim Unmounting
      return () => {
        if (videoRef.current) {
          videoRef.current.innerHTML = '';
          streamRef.current = null;
        }
      };
    }
  }, [printer.type]); // Nur bei Änderung des Printer-Typs neu verbinden

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          background: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '15px',
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid rgba(0, 255, 255, 0.2)',
          aspectRatio: '16/9',  // Festes Seitenverhältnis statt fester Höhe
          '&:hover': {
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)'
          }
        }}
      >
        {/* Stream Container */}
        <Box sx={{ 
          position: 'relative',
          width: '100%',
          height: '100%',
        }}>
          {printer.type === 'BAMBULAB' ? (
            <div ref={videoRef} style={{ width: '100%', height: '100%' }} />
          ) : (
            <RTSPStream 
              printer={printer} 
              fullscreen={isFullscreen}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          )}
          
          {/* Header mit Name und Buttons */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '8px 12px',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 2,
              height: '48px'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ 
                color: '#fff', 
                fontSize: '1.1rem',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}>
                {printer.name}
              </Typography>
              
              <IconButton
                onClick={handleEmergencyStop}
                disabled={isEmergencyStopping || printer.status === 'offline'}
                sx={{
                  color: 'rgba(255, 85, 85, 0.7)',
                  padding: '4px',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 0, 0, 0.1)'
                  },
                  '&.Mui-disabled': {
                    color: 'rgba(255, 85, 85, 0.3)'
                  }
                }}
              >
                <StopCircleIcon fontSize="small" />
              </IconButton>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                onClick={() => onFullscreenToggle(printer)}
                sx={{
                  color: '#fff',
                  padding: '4px',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.3)'
                  }
                }}
              >
                <FullscreenIcon fontSize="small" />
              </IconButton>
              {!isFullscreen && (
                <IconButton
                  onClick={handleDelete}
                  sx={{
                    color: '#fff',
                    padding: '4px',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.3)'
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>

          {/* Status Chip */}
          <Box
            sx={{
              position: 'absolute',
              bottom: '12px',  // Anpassung für vertikale Zentrierung mit Temperatur-Text
              right: '12px',
              zIndex: 2
            }}
          >
            <Chip
              label={printer.status || 'Unknown'}
              sx={{
                backgroundColor: `${getStatusColor(printer.status)}22`,
                border: `1px solid ${getStatusColor(printer.status)}`,
                color: getStatusColor(printer.status),
                textTransform: 'capitalize',
                fontSize: '0.8rem',
                height: '24px',
                '& .MuiChip-label': {
                  px: 1,
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                }
              }}
            />
          </Box>

          {/* Footer mit Temperaturen und Progress */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              transition: 'height 0.3s ease-in-out',
              height: printer.status?.toLowerCase() === 'printing' ? '80px' : '40px',
              background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
              zIndex: 2,
            }}
          >
            {/* Progress und Zeit wenn der Drucker druckt */}
            {printer.status?.toLowerCase() === 'printing' && (
              <Box sx={{ 
                padding: '8px 12px 0 12px',
              }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#fff',
                    fontSize: '0.9rem',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                  }}
                >
                  Progress: {printer.progress || 0}% | 
                  Time Left: {printer.remaining_time || 0} min
                </Typography>
              </Box>
            )}

            <Typography
              variant="body2"
              sx={{
                position: 'absolute',
                bottom: '8px',
                left: '12px',
                color: '#fff',
                fontSize: '0.9rem',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}
            >
              {printer.type === 'BAMBULAB' ? 'Nozzle' : 'Hotend'}: {
                printer.type === 'BAMBULAB' 
                  ? printer.temperatures?.nozzle?.toFixed(1) 
                  : (printer.temperatures?.hotend || printer.temperatures?.nozzle || printer.temps?.hotend || printer.temps?.nozzle || 0).toFixed(1)
              }°C | 
              Bed: {(printer.temperatures?.bed || printer.temps?.bed || 0).toFixed(1)}°C | 
              Chamber: {(printer.temperatures?.chamber || printer.temps?.chamber || 0).toFixed(1)}°C
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

        {isEmergencyStopping && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <Typography sx={{ color: '#fff', fontWeight: 'bold' }}>
              Executing emergency stop...
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Emergency Stop Dialog */}
      <EmergencyStopDialog
        open={showEmergencyDialog}
        onClose={() => setShowEmergencyDialog(false)}
        onConfirm={confirmEmergencyStop}
        printerName={printer.name}
      />
    </>
  );
};

export default PrinterCard; 