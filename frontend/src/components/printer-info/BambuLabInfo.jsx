import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import logger from '../../utils/logger';

const BambuLabInfo = ({ printer, status }) => {
  // Debug logging
  console.log('BambuLabInfo render:', {
    printer,
    status,
    temps: status?.temps,
    nozzle_temp: status?.temps?.nozzle,
    bed_temp: status?.temps?.bed,
    chamber_temp: status?.temps?.chamber
  });

  return (
    <Box sx={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '8px',
      background: 'rgba(0,0,0,0.7)',
      color: '#00ffff',
      zIndex: 2
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2">
          Status: {status?.status || 'offline'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="body2">
            Nozzle: {status?.temps?.nozzle?.toFixed(1) || '-.--'}°C
          </Typography>
          <Typography variant="body2">
            Bed: {status?.temps?.bed?.toFixed(1) || '-.--'}°C
          </Typography>
          <Typography variant="body2">
            Chamber: {status?.temps?.chamber?.toFixed(1) || '-.--'}°C
          </Typography>
        </Box>
      </Box>
      
      {(status?.progress > 0 || status?.status === 'finish') && (
        <>
          <LinearProgress 
            variant="determinate" 
            value={status?.progress || 0}
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(0, 255, 255, 0.2)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#00ffff'
              }
            }}
          />
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
            Progress: {(status?.progress || 0).toFixed(1)}%
          </Typography>
        </>
      )}
    </Box>
  );
};

export default BambuLabInfo; 