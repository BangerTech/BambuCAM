import React, { useEffect } from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

const InfoContainer = styled(Box)(({ theme }) => ({
  padding: '1rem',
  color: '#00ffff'
}));

const ProgressBar = styled(LinearProgress)(({ theme }) => ({
  height: 10,
  borderRadius: 5,
  backgroundColor: 'rgba(0, 255, 255, 0.1)',
  '& .MuiLinearProgress-bar': {
    backgroundColor: '#00ffff'
  }
}));

const statusMap = {
  'ready': 'Ready',
  'printing': 'Printing',
  'paused': 'Paused',
  'error': 'Error',
  'offline': 'Offline',
  'connecting': 'Connecting...'
};

const OctoPrintInfo = ({ printer }) => {
  const {
    temperatures = {},
    progress = 0,
    status = 'connecting',
    currentFile = '',
    streamUrl = ''
  } = printer;

  useEffect(() => {
    // Verbinde mit MQTT über WebSocket
    const ws = new WebSocket(`ws://${window.location.hostname}/mqtt`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Update UI mit neuen Daten
    };
    
    return () => ws.close();
  }, [printer.id]);

  useEffect(() => {
    if (streamUrl) {
      const video = document.getElementById(`video-${printer.id}`);
      if (video) {
        video.src = streamUrl;
      }
    }
  }, [streamUrl, printer.id]);

  return (
    <InfoContainer>
      <Typography variant="body1" sx={{ mb: 1 }}>
        Status: {statusMap[status] || status}
      </Typography>
      <Typography variant="body2">
        Hotend: {temperatures.hotend?.toFixed(1)}°C
      </Typography>
      <Typography variant="body2">
        Bed: {temperatures.bed?.toFixed(1)}°C
      </Typography>
      {status === 'printing' && (
        <Box sx={{ mt: 1 }}>
          <ProgressBar variant="determinate" value={progress} />
          <Typography variant="body2" align="right">
            {progress?.toFixed(1)}%
          </Typography>
        </Box>
      )}
    </InfoContainer>
  );
};

export default OctoPrintInfo; 