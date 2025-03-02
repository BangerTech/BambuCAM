import React, { useEffect, useState, useRef } from 'react';
import { Paper, Typography, Box, Chip, LinearProgress, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { IconButton } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DeleteIcon from '@mui/icons-material/Delete';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { Logger, LOG_CATEGORIES } from '../utils/logger';
import Hls from 'hls.js';
import { API_URL } from '../config';  // Importiere API_URL aus der Config
import CloudIcon from '@mui/icons-material/Cloud';
import EmergencyStopDialog from './EmergencyStopDialog';

// Status-Farben definieren
const getStatusColor = (status, isOnline) => {
  if (!isOnline) return '#888888'; // Grau für offline
  
  switch(status?.toLowerCase()) {
    case 'printing':
      return '#00ff00';  // Grün
    case 'finished':
      return '#00ffff';  // Cyan
    case 'idle':
      return '#00ff00';  // Grün für verbunden/idle
    case 'paused':
      return '#ffaa00';  // Orange
    case 'error':
      return '#ff0000';  // Rot
    default:
      return '#00ff00';  // Grün für verbunden/unbekannt
  }
};

const GlassPaper = styled(Paper)(({ theme }) => ({
  background: 'rgba(0, 0, 0, 0.9)',
  backdropFilter: 'blur(10px)',
  borderRadius: '15px',
  position: 'relative',
  width: '100%',
  aspectRatio: '16/9',
  overflow: 'hidden',
  border: '1px solid rgba(0, 255, 255, 0.2)',
  boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)',
  '&:hover': {
    boxShadow: '0 0 20px rgba(0, 255, 255, 0.4)'
  }
}));

const VideoStream = styled('video')({
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  position: 'absolute',
  top: 0,
  left: 0,
  zIndex: 1
});

const CloudPrinterCard = ({ printer, onDelete, isFullscreen, onFullscreenToggle }) => {
  console.log("Initial printer data:", printer); // DEBUG: Log initial printer data
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEmergencyStopping, setIsEmergencyStopping] = useState(false);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const isMounted = useRef(true);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [printerInfo, setPrinterInfo] = useState({
    id: printer.id,
    name: printer.name || 'Unknown Printer',
    status: printer.online ? 'online' : 'offline',
    model: printer.model || 'Unknown Model',
    cloudId: printer.cloudId,
    accessCode: printer.accessCode,
    temperatures: {
      hotend: printer.temperatures?.hotend || 0,
      bed: printer.temperatures?.bed || 0,
      chamber: printer.temperatures?.chamber || 0
    },
    targets: {
      hotend: printer.targets?.hotend || 0,
      bed: printer.targets?.bed || 0
    },
    progress: printer.progress || 0,
    print_status: printer.print_status || 'IDLE'
  });
  
  console.log("Initial printerInfo state:", printerInfo); // DEBUG: Log initial state
  
  const [streamUrl, setStreamUrl] = useState(null);
  const [streamError, setStreamError] = useState(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(printerInfo.id);
    } catch (error) {
      console.error('Error deleting printer:', error);
    } finally {
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
      } else {
        Logger.printer('Emergency stop failed', { printer: printer.id, error: result.error || result.message });
        alert(`Error during emergency stop: ${result.error || result.message}`);
      }
    } catch (error) {
      Logger.printer('Emergency stop error', { printer: printer.id, error });
      alert(`Error during emergency stop: ${error.message}`);
    } finally {
      if (isMounted.current) {
        setIsEmergencyStopping(false);
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

  // Polling für Live-Updates
  useEffect(() => {
    const fetchPrinterStatus = async () => {
      try {
        console.log(`Fetching status for printer ${printerInfo.id}`); // DEBUG
        
        const response = await fetch(`${API_URL}/cloud/printers/${printerInfo.id}/status`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Raw API response:", data); // DEBUG: Log raw API response
        
        if (isMounted.current) {
          Logger.debug('Cloud printer status update:', data);
          
          // Extrahiere die Temperaturdaten aus der Antwort
          const temperatures = {
            hotend: data.temperatures?.hotend !== undefined ? parseFloat(data.temperatures.hotend) : 
                   data.print?.nozzle_temper !== undefined ? parseFloat(data.print.nozzle_temper) : null,
            bed: data.temperatures?.bed !== undefined ? parseFloat(data.temperatures.bed) : 
                 data.print?.bed_temper !== undefined ? parseFloat(data.print.bed_temper) : null,
            chamber: data.temperatures?.chamber !== undefined ? parseFloat(data.temperatures.chamber) : 
                    data.print?.chamber_temper !== undefined ? parseFloat(data.print.chamber_temper) : null
          };
          
          console.log("Extracted temperatures:", temperatures); // DEBUG: Log extracted temperatures
          
          // Aktualisiere den Printer-Status
          setPrinterInfo(prev => {
            const newState = {
              ...prev,
              status: data.online ? 'online' : 'offline',
              temperatures: temperatures,
              targets: {
                hotend: data.targets?.hotend !== undefined ? parseFloat(data.targets.hotend) : 
                        data.print?.nozzle_target_temper !== undefined ? parseFloat(data.print.nozzle_target_temper) : null,
                bed: data.targets?.bed !== undefined ? parseFloat(data.targets.bed) : 
                     data.print?.bed_target_temper !== undefined ? parseFloat(data.print.bed_target_temper) : null
              },
              progress: data.progress !== undefined ? parseFloat(data.progress) : 
                       data.print?.mc_percent !== undefined ? parseFloat(data.print.mc_percent) : 0,
              current_layer: data.current_layer !== undefined ? parseInt(data.current_layer) : 
                           data.print?.current_layer !== undefined ? parseInt(data.print.current_layer) : 0,
              total_layers: data.total_layers !== undefined ? parseInt(data.total_layers) : 
                          data.print?.total_layers !== undefined ? parseInt(data.print.total_layers) : 0,
              remaining_time: data.remaining_time !== undefined ? parseInt(data.remaining_time) : 
                            data.print?.mc_remaining_time !== undefined ? parseInt(data.print.mc_remaining_time) : 0,
              print_status: data.print_status || data.print?.gcode_state || 'IDLE'
            };
            console.log("Updated printerInfo:", newState); // DEBUG: Log updated state
            return newState;
          });
        }
      } catch (error) {
        console.error('Error fetching printer status:', error);
      }
    };

    const interval = setInterval(fetchPrinterStatus, 5000);
    fetchPrinterStatus(); // Initial fetch

    return () => clearInterval(interval);
  }, [printerInfo.id]);

  // Stream URL abrufen und aktualisieren
  useEffect(() => {
    const fetchStreamUrl = async () => {
      try {
        const response = await fetch(`${API_URL}/cloud/printers/${printerInfo.id}/stream`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.url && videoRef.current && isMounted.current) {
          setStreamUrl(data.url);
          setStreamError(null);

          if (Hls.isSupported()) {
            if (hlsRef.current) {
              hlsRef.current.destroy();
            }
            const hls = new Hls({
              debug: false,
              enableWorker: true,
              lowLatencyMode: true
            });
            hlsRef.current = hls;
            hls.loadSource(data.url);
            hls.attachMedia(videoRef.current);
            hls.on(Hls.Events.ERROR, (event, data) => {
              console.error('HLS error:', data);
              if (data.fatal) {
                setStreamError('Stream error occurred');
                hls.destroy();
              }
            });
          } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.current.src = data.url;
          } else {
            setStreamError('HLS is not supported in this browser');
          }
        }
      } catch (error) {
        console.error('Error fetching stream URL:', error);
        setStreamError('Failed to fetch stream URL');
      }
    };

    fetchStreamUrl();
    const interval = setInterval(fetchStreamUrl, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, [printerInfo.id]);

  // Don't render if no id is available
  if (!printerInfo.id) {
    return null;
  }

  // Bestimme den Status für die Anzeige
  const displayStatus = printerInfo.print_status || (printerInfo.status === 'online' ? 'IDLE' : 'OFFLINE');
  const isOnline = printerInfo.status === 'online';
  
  // Formatiere die Temperaturwerte
  const formatTemp = (temp) => {
    if (temp === undefined || temp === null || isNaN(temp)) return '-.--';
    return parseFloat(temp).toFixed(1);
  };
  
  console.log("Rendering with temperatures:", printerInfo.temperatures); // DEBUG: Log temperatures before rendering

  return (
    <>
      <GlassPaper elevation={3}>
        {/* Stream Container */}
        <Box sx={{ 
          position: 'relative',
          width: '100%',
          height: '100%',
        }}>
          {streamUrl && !streamError && (
            <VideoStream
              ref={videoRef}
              autoPlay
              muted
              playsInline
              controls={isFullscreen}
            />
          )}

          {streamError && (
            <Box sx={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              color: '#ff4444',
              textAlign: 'center',
              zIndex: 2
            }}>
              <Typography variant="body1">{streamError}</Typography>
            </Box>
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
                {printerInfo.name}
              </Typography>
              
              <IconButton
                onClick={handleEmergencyStop}
                disabled={isEmergencyStopping || !printer.online}
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
              
              <Chip
                icon={<CloudIcon style={{ fontSize: '0.8rem', color: '#00ffff' }} />}
                label="CLOUD"
                size="small"
                sx={{
                  height: '20px',
                  backgroundColor: 'rgba(0, 255, 255, 0.1)',
                  border: '1px solid rgba(0, 255, 255, 0.5)',
                  color: '#00ffff',
                  '& .MuiChip-label': {
                    px: 1,
                    fontSize: '0.7rem',
                    fontWeight: 'bold'
                  }
                }}
              />
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
              bottom: '12px',
              right: '12px',
              zIndex: 2
            }}
          >
            <Chip
              label={displayStatus}
              sx={{
                backgroundColor: `${getStatusColor(displayStatus, isOnline)}22`,
                border: `1px solid ${getStatusColor(displayStatus, isOnline)}`,
                color: getStatusColor(displayStatus, isOnline),
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

          {/* Progress Bar and Time */}
          {printerInfo.print_status?.toLowerCase() === 'printing' && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '8px',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                zIndex: 2
              }}
            >
              <LinearProgress 
                variant="determinate" 
                value={printerInfo.progress || 0} 
                sx={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#fff'
                  }
                }}
              />
              <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                Progress: {(printerInfo.progress || 0).toFixed(1)}%
                {printerInfo.remaining_time > 0 && ` (${Math.floor(printerInfo.remaining_time / 60)}min remaining)`}
                {printerInfo.current_layer > 0 && printerInfo.total_layers > 0 && 
                  ` | Layer ${printerInfo.current_layer}/${printerInfo.total_layers}`
                }
              </Typography>
            </Box>
          )}

          {/* Footer mit Temperaturen und Progress */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              transition: 'height 0.3s ease-in-out',
              height: printerInfo.progress > 0 ? '80px' : '40px',
              background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
              zIndex: 2,
            }}
          >
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
              Hotend: {formatTemp(printerInfo.temperatures?.hotend)}°C | 
              Bed: {formatTemp(printerInfo.temperatures?.bed)}°C | 
              Chamber: {formatTemp(printerInfo.temperatures?.chamber)}°C
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
      </GlassPaper>

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

export default CloudPrinterCard; 