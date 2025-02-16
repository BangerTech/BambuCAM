import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import logger from '../../utils/logger';

const CrealityInfo = ({ printer }) => {
  logger.printer('Rendering CrealityInfo with data:', {
    temps: printer.temperatures,
    targets: printer.targets,
    state: printer.state,
    progress: printer.progress
  });

  const temps = printer.temperatures || {};
  const targets = printer.targets || {};

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
          Status: {printer.state || 'offline'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="body2">
            Hotend: {temps.hotend?.toFixed(1) || '-.--'}°C
            {targets.hotend > 0 && ` / ${targets.hotend}°C`}
          </Typography>
          <Typography variant="body2">
            Bed: {temps.bed?.toFixed(1) || '-.--'}°C
            {targets.bed > 0 && ` / ${targets.bed}°C`}
          </Typography>
          <Typography variant="body2">
            Chamber: {temps.chamber?.toFixed(1) || '-.--'}°C
          </Typography>
        </Box>
      </Box>
      {printer.progress > 0 && (
        <>
          <LinearProgress 
            variant="determinate" 
            value={printer.progress}
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
            Progress: {printer.progress.toFixed(1)}%
            {printer.remaining_time && ` | Remaining: ${printer.remaining_time}min`}
          </Typography>
        </>
      )}
    </Box>
  );
};

export default CrealityInfo; 