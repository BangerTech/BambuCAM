import React, { useEffect, useState, useRef } from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { IconButton } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DeleteIcon from '@mui/icons-material/Delete';
import { Logger, LOG_CATEGORIES } from '../utils/logger';
import Hls from 'hls.js';
import { API_URL } from '../config';  // Importiere API_URL aus der Config

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
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between'
}));

const StatusBadge = styled(Box)(({ status }) => ({
  position: 'absolute',
  top: '10px',
  right: '10px',
  padding: '4px 12px',
  borderRadius: '12px',
  backgroundColor: status === 'online' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
  border: `1px solid ${status === 'online' ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)'}`,
  color: status === 'online' ? '#00ff00' : '#ff0000',
  fontSize: '0.8rem',
  fontWeight: 'bold'
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [printerInfo, setPrinterInfo] = useState({
    id: printer.id || printer.cloudId,
    name: printer.name,
    status: printer.status || 'offline',
    model: printer.model,
    cloudId: printer.cloudId,
    accessCode: printer.accessCode,
    temperatures: {
      hotend: 0,
      bed: 0,
      chamber: 0
    },
    progress: 0
  });
  const [streamUrl, setStreamUrl] = useState(null);
  const videoRef = useRef(null);

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

  // Polling für Live-Updates
  useEffect(() => {
    const fetchPrinterStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/cloud/printer/${printer.cloudId}/status`);
        if (response.ok) {
          const data = await response.json();
          setPrinterInfo(prev => ({
            ...prev,
            status: data.online ? 'online' : 'offline',
            temperatures: data.temperatures,
            progress: data.progress
          }));
        }
      } catch (error) {
        console.error('Error fetching printer status:', error);
      }
    };

    // Aktualisiere alle 5 Sekunden
    const interval = setInterval(fetchPrinterStatus, 5000);
    fetchPrinterStatus(); // Initial fetch

    return () => clearInterval(interval);
  }, [printer.cloudId]);

  // Stream URL abrufen und aktualisieren
  useEffect(() => {
    const fetchStreamUrl = async () => {
      try {
        const response = await fetch(`${API_URL}/api/cloud/printer/${printer.cloudId}/stream`);
        if (response.ok) {
          const data = await response.json();
          if (data.url && videoRef.current) {
            setStreamUrl(data.url);
            // Starte Stream mit HLS.js
            if (Hls.isSupported()) {
              const hls = new Hls();
              hls.loadSource(data.url);
              hls.attachMedia(videoRef.current);
            }
            // Fallback für native HLS Support
            else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
              videoRef.current.src = data.url;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching stream URL:', error);
      }
    };

    // Aktualisiere Stream URL alle 5 Minuten
    fetchStreamUrl();
    const interval = setInterval(fetchStreamUrl, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, [printer.cloudId]);

  return (
    <GlassPaper elevation={3}>
      <StatusBadge status={printerInfo.status}>
        {printerInfo.status.toUpperCase()}
      </StatusBadge>
      
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ color: '#00ffff', mb: 1 }}>
          {printerInfo.name}
        </Typography>
        
        <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
          Model: {printerInfo.model}
        </Typography>
        
        <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
          Cloud ID: {printerInfo.id}
        </Typography>

        {/* Temperaturanzeige */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
            Hotend: {printerInfo.temperatures.hotend}°C
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
            Bed: {printerInfo.temperatures.bed}°C
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
            Chamber: {printerInfo.temperatures.chamber}°C
          </Typography>
        </Box>

        {/* Fortschrittsanzeige */}
        {printerInfo.progress > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
              Progress: {printerInfo.progress}%
            </Typography>
          </Box>
        )}
      </Box>

      {streamUrl && (
        <VideoStream
          ref={videoRef}
          autoPlay
          muted
          playsInline
          controls={isFullscreen}
        />
      )}

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
    </GlassPaper>
  );
};

export default CloudPrinterCard; 