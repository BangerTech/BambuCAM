import React from 'react';
import { Fab, Tooltip } from '@mui/material';
import MemoryIcon from '@mui/icons-material/Memory';

const SystemStatsButton = ({ onClick }) => {
  return (
    <Tooltip title="System Stats">
      <Fab
        size="small"
        onClick={onClick}
        sx={{
          position: 'fixed',
          bottom: 15,
          left: 15,
          width: 40,
          height: 40,
          minHeight: 'unset',
          bgcolor: 'rgba(0, 0, 0, 0.6)',
          border: '1px solid #00ffff',
          color: '#00ffff',
          '&:hover': {
            bgcolor: 'rgba(0, 255, 255, 0.1)',
          }
        }}
      >
        <MemoryIcon sx={{ fontSize: 20 }} />
      </Fab>
    </Tooltip>
  );
};

export default SystemStatsButton; 