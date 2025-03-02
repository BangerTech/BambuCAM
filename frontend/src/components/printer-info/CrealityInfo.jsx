import React from 'react';
import { Box, Typography, LinearProgress, IconButton } from '@mui/material';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { Logger, LOG_CATEGORIES } from '../../utils/logger';

const CrealityInfo = ({ printer, onEmergencyStop }) => {
  Logger.printer('Rendering CrealityInfo with data:', {
    temps: printer.temperatures,
    targets: printer.targets,
    state: printer.state,
    progress: printer.progress
  });

  const temps = printer.temperatures || {};
  const targets = printer.targets || {};
  
  // Chamber temp kann entweder direkt oder als chamber_temp kommen
  const chamberTemp = temps.chamber || (temps.chamber_temp?.temperature);

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">
            Status: {printer.state || 'offline'}
          </Typography>
          <IconButton
            onClick={() => onEmergencyStop && onEmergencyStop(printer.id)}
            disabled={!printer.state || printer.state === 'offline'}
            sx={{
              color: '#ff5555',
              padding: '2px',
              height: '24px',
              width: '24px',
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
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="body2">
            Hotend: {temps.hotend?.toFixed(1) || '-.--'}°C
            {targets.hotend > 0 && ` / ${targets.hotend}°C`}
          </Typography>
          <Typography variant="body2">
            Bed: {temps.bed?.toFixed(1) || '-.--'}°C
            {targets.bed > 0 && ` / ${targets.bed}°C`}
          </Typography>
          {chamberTemp !== undefined && (
            <Typography variant="body2">
              Chamber: {chamberTemp.toFixed(1) || '-.--'}°C
            </Typography>
          )}
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