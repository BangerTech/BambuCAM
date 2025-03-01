import React, { useEffect, useState } from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { API_URL } from '../../config';

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
  'connecting': 'Connecting...',
  'completed': 'Print Completed',
  'failed': 'Print Failed'
};

const OctoPrintInfo = ({ printer }) => {
  const [printerStatus, setPrinterStatus] = useState({
    id: printer.id,
    name: printer.name,
    temps: {
      hotend: 0,
      nozzle: 0,
      bed: 0,
      chamber: 0
    },
    temperatures: {
      hotend: 0,
      nozzle: 0,
      bed: 0,
      chamber: 0
    },
    status: 'connecting',
    progress: 0
  });

  // Fetch status periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/printers/${printer.id}/status`);
        if (response.ok) {
          const data = await response.json();
          console.log('OctoPrint status response:', data);
          
          // Get current temps to preserve non-zero values
          const currentTemps = printerStatus.temps || {};
          const currentTemperatures = printerStatus.temperatures || {};
          
          // Only update temperatures if they are non-zero in the new data
          const newTemps = data.temps || {};
          const newTemperatures = data.temperatures || {};
          
          const mergedTemps = {
            hotend: newTemps.hotend > 0 ? newTemps.hotend : (currentTemps.hotend || 0),
            nozzle: newTemps.nozzle > 0 ? newTemps.nozzle : (currentTemps.nozzle || 0),
            bed: newTemps.bed > 0 ? newTemps.bed : (currentTemps.bed || 0),
            chamber: newTemps.chamber > 0 ? newTemps.chamber : (currentTemps.chamber || 0)
          };
          
          const mergedTemperatures = {
            hotend: newTemperatures.hotend > 0 ? newTemperatures.hotend : (currentTemperatures.hotend || 0),
            nozzle: newTemperatures.nozzle > 0 ? newTemperatures.nozzle : (currentTemperatures.nozzle || 0),
            bed: newTemperatures.bed > 0 ? newTemperatures.bed : (currentTemperatures.bed || 0),
            chamber: newTemperatures.chamber > 0 ? newTemperatures.chamber : (currentTemperatures.chamber || 0)
          };
          
          // Merge the API response with existing printer data
          setPrinterStatus(prevStatus => ({
            ...prevStatus,
            id: printer.id,
            name: printer.name,
            temps: mergedTemps,
            temperatures: mergedTemperatures,
            status: data.status || prevStatus.status,
            progress: data.progress || prevStatus.progress
          }));
        }
      } catch (error) {
        console.error('Error fetching OctoPrint status:', error);
      }
    };

    // Initial fetch
    fetchStatus();

    // Set up polling
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [printer.id, printer.name]);

  // Use the status from state
  const {
    temps = { hotend: 0, nozzle: 0, bed: 0, chamber: 0 },
    temperatures = { hotend: 0, nozzle: 0, bed: 0, chamber: 0 },
    status = 'connecting',
    progress = 0
  } = printerStatus;

  // Get hotend temperature, supporting both 'hotend' and 'nozzle' property names
  const hotendTemp = temps.hotend ?? temps.nozzle ?? temperatures.hotend ?? temperatures.nozzle ?? 0;
  const bedTemp = temps.bed ?? temperatures.bed ?? 0;
  const chamberTemp = temps.chamber ?? temperatures.chamber ?? 0;

  useEffect(() => {
    if (printer.streamUrl) {
      const video = document.getElementById(`video-${printer.id}`);
      if (video) {
        video.src = printer.streamUrl;
      }
    }
  }, [printer.streamUrl, printer.id]);

  return (
    <InfoContainer>
      <Typography variant="body1" sx={{ mb: 1 }}>
        Status: {statusMap[status] || status}
      </Typography>
      <Typography variant="body2">
        Hotend: {hotendTemp?.toFixed(1)}°C
      </Typography>
      <Typography variant="body2">
        Bed: {bedTemp?.toFixed(1)}°C
      </Typography>
      <Typography variant="body2">
        Chamber: {chamberTemp?.toFixed(1)}°C
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