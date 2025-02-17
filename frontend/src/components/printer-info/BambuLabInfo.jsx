import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import logger from '../../utils/logger';

const BambuLabInfo = ({ printer, status }) => {
  // Debug-Logging
  logger.debug('BambuLabInfo render:', {
    printer_id: printer?.id,
    status: status?.status,
    temperatures: status?.temperatures,
    targets: status?.targets,
    progress: status?.progress
  });

  const formatTemp = (temp) => {
    return temp ? `${temp.toFixed(1)}°C` : '0°C';
  };

  return (
    <Box sx={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '8px',
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      zIndex: 2
    }}>
      {/* Status und Temperaturen */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2">
          Status: {status?.status || 'Offline'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="body2">
            Hotend: {formatTemp(status?.temperatures?.hotend)} / {formatTemp(status?.targets?.hotend)}
          </Typography>
          <Typography variant="body2">
            Bed: {formatTemp(status?.temperatures?.bed)} / {formatTemp(status?.targets?.bed)}
          </Typography>
          <Typography variant="body2">
            Chamber: {formatTemp(status?.temperatures?.chamber)}
          </Typography>
        </Box>
      </Box>

      {/* Fortschritt */}
      {status?.progress > 0 && (
        <>
          <LinearProgress 
            variant="determinate" 
            value={status.progress} 
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
            Progress: {status.progress.toFixed(1)}%
            {status?.remaining_time > 0 && ` (${Math.floor(status.remaining_time / 60)}min remaining)`}
          </Typography>
        </>
      )}
    </Box>
  );
};

export default BambuLabInfo; 