import React from 'react';
import { Box, Typography } from '@mui/material';

const CrealityInfo = ({ printer }) => {
  return (
    <Box sx={{ p: 2, color: '#00ffff' }}>
      <Typography variant="body2">
        Model: {printer.model}
      </Typography>
      <Typography variant="body2">
        Speed: {printer.speed || 'N/A'}
      </Typography>
      <Typography variant="body2">
        Fan Speed: {printer.fan_speed || 'N/A'}%
      </Typography>
      {/* Weitere Creality spezifische Informationen */}
    </Box>
  );
};

export default CrealityInfo; 