import React, { useState } from 'react';
import { Box, Tooltip, CircularProgress } from '@mui/material';

const GodModeBadge = () => {
  const [pressTimer, setPressTimer] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  const handleMouseDown = () => {
    setIsHolding(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsHolding(false);
          // Deaktiviere God Mode erst nach vollständigem Progress
          localStorage.setItem('godMode', 'false');
          window.location.reload();
          return 0;
        }
        return prev + 2; // Langsamerer Progress
      }, 40);
    });
    setPressTimer(interval);
  };

  const handleMouseUp = () => {
    if (pressTimer) {
      clearInterval(pressTimer);
      setPressTimer(null);
      setIsHolding(false);
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
          border: '2px solid #00ffff',
          boxShadow: '0 0 10px #00ffff',
          animation: 'godModeBadgePulse 2s infinite',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          transform: isHolding ? 'scale(0.95)' : 'scale(1)',
          '&:hover': {
            boxShadow: '0 0 20px #00ffff',
          },
          '@keyframes godModeBadgePulse': {
            '0%': { 
              boxShadow: '0 0 5px #00ffff',
              transform: isHolding ? 'scale(0.95)' : 'scale(1)'
            },
            '50%': { 
              boxShadow: '0 0 15px #00ffff',
              transform: isHolding ? 'scale(0.95)' : 'scale(1.05)'
            },
            '100%': { 
              boxShadow: '0 0 5px #00ffff',
              transform: isHolding ? 'scale(0.95)' : 'scale(1)'
            }
          }
        }}
      >
        <span 
          style={{ 
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isHolding ? 0.7 : 1,
            transition: 'opacity 0.3s ease'
          }}
        >
          <img 
            src="/thunder.png" 
            alt="Thunder"
            style={{ 
              width: '100%',
              height: '100%',
              filter: 'drop-shadow(0 0 5px #00ffff)'
            }} 
          />
        </span>
        {isHolding && (
          <CircularProgress
            variant="determinate"
            value={progress}
            sx={{
              position: 'absolute',
              top: -5,
              left: -5,
              width: 'calc(100% + 10px) !important',
              height: 'calc(100% + 10px) !important',
              color: '#00ffff',
              opacity: 1,
              '& .MuiCircularProgress-circle': {
                strokeWidth: 2.5,
                stroke: '#00ffff',
                filter: 'drop-shadow(0 0 3px #00ffff)'
              }
            }}
          />
        )}
        {isHolding && progress >= 95 && (
          <Box
            sx={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '17px',
              backgroundColor: 'rgba(0, 255, 255, 0.2)',
              animation: 'pulse 0.5s infinite'
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
};

export default GodModeBadge; 