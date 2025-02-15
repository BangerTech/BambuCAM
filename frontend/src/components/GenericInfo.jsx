import React from 'react';
import { Box, Typography } from '@mui/material';

const GenericInfo = ({ printer }) => {
  return (
    <Box sx={{ p: 2, color: '#00ffff' }}>
      <Typography variant="body2">
        Model: {printer.model}
      </Typography>
      <Typography variant="body2">
        Type: {printer.type}
      </Typography>
      {/* Basis-Informationen für andere Drucker */}
    </Box>
  );
};

export default GenericInfo; 