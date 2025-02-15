import React from 'react';
import { Box, Typography } from '@mui/material';

const BambuLabInfo = ({ printer }) => {
  return (
    <Box sx={{ p: 2, color: '#00ffff' }}>
      <Typography variant="body2">
        Model: {printer.model}
      </Typography>
      <Typography variant="body2">
        AMS: {printer.ams ? 'Yes' : 'No'}
      </Typography>
      <Typography variant="body2">
        Speed: {printer.speed || 'N/A'}
      </Typography>
      <Typography variant="body2">
        Layer: {printer.layer || 'N/A'}
      </Typography>
      {/* Weitere Bambu Lab spezifische Informationen */}
    </Box>
  );
};

export default BambuLabInfo; 