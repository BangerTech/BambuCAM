import React, { useState } from 'react';
import { Box, Tooltip, CircularProgress } from '@mui/material';

const GodModeBadge = () => {
  const [pressTimer, setPressTimer] = useState(null);
  const [progress, setProgress] = useState(0);

  const handleMouseDown = () => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          // Deaktiviere God Mode
          localStorage.setItem('godMode', 'false');
          window.location.reload();
          return 0;
        }
        return prev + 5;
      });
    }, 50);
    setPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (pressTimer) {
      clearInterval(pressTimer);
      setPressTimer(null);
      setProgress(0);
    }
  };

  return (
    <Tooltip title="God Mode Active" arrow>
      <Box
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        sx={{
          width: '62px',
          height: '34px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '17px',
          border: '2px solid #9333ea',
          boxShadow: '0 0 10px #9333ea',
          animation: 'godModeBadgePulse 2s infinite',
          cursor: 'pointer',
          '&:hover': {
            boxShadow: '0 0 20px #9333ea',
          },
          '@keyframes godModeBadgePulse': {
            '0%': { 
              boxShadow: '0 0 5px #9333ea',
              transform: 'scale(1)'
            },
            '50%': { 
              boxShadow: '0 0 15px #9333ea',
              transform: 'scale(1.05)'
            },
            '100%': { 
              boxShadow: '0 0 5px #9333ea',
              transform: 'scale(1)'
            }
          }
        }}
      >
        <span 
          style={{ 
            fontSize: '1.5rem',
            filter: 'drop-shadow(0 0 5px #00ffff)'
          }}
        >
          🔮
        </span>
        {progress > 0 && (
          <CircularProgress
            variant="determinate"
            value={progress}
            size={24}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              color: '#9333ea'
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
};

export default GodModeBadge; 