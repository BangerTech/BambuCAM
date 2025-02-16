import React from 'react';
import { Box, Typography } from '@mui/material';

const CrealityInfo = ({ printer }) => {
  const temps = printer.temperatures || {};
  const targets = printer.targets || {};

  return (
    <Box sx={{ p: 2, color: '#00ffff' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="body2">
            Hotend: {temps.hotend?.toFixed(1) || '0.0'}°C
            {targets.hotend > 0 && ` / ${targets.hotend}°C`}
          </Typography>
          <Typography variant="body2">
            Bed: {temps.bed?.toFixed(1) || '0.0'}°C
            {targets.bed > 0 && ` / ${targets.bed}°C`}
          </Typography>
          {temps.chamber !== undefined && (
            <Typography variant="body2">
              Chamber: {temps.chamber?.toFixed(1) || '0.0'}°C
            </Typography>
          )}
        </Box>
        <Typography variant="body2">
          Status: {printer.state || 'offline'}
        </Typography>
        {printer.progress > 0 && (
          <>
            <Typography variant="body2">
              Progress: {printer.progress.toFixed(1)}%
            </Typography>
            {printer.remaining_time && (
              <Typography variant="body2">
                Time Remaining: {printer.remaining_time}min
              </Typography>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default CrealityInfo; 