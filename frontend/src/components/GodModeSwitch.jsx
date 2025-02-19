import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { NeonSwitch } from '../styles/NeonSwitch';
import styled from '@emotion/styled';

const GodModeContainer = styled(Box)(({ 'data-godmode': isGodMode }) => ({
  position: 'relative',
  '&::after': isGodMode ? {
    content: '""',
    position: 'absolute',
    top: '-10px',
    left: '-10px',
    right: '-10px',
    bottom: '-10px',
    border: '2px solid #00ffff',
    borderRadius: '25px',
    animation: 'godModeActivate 1s ease-out',
    zIndex: -1
  } : {},
  '@keyframes godModeActivate': {
    '0%': {
      transform: 'scale(1)',
      opacity: 0,
      boxShadow: '0 0 0 #00ffff'
    },
    '50%': {
      transform: 'scale(1.2)',
      opacity: 0.8,
      boxShadow: '0 0 30px #00ffff'
    },
    '100%': {
      transform: 'scale(1)',
      opacity: 1,
      boxShadow: '0 0 15px #00ffff'
    }
  }
}));

const GodModeSwitch = ({ mode, onModeChange, onGodModeActivate }) => {
  const [pressTimer, setPressTimer] = useState(null);
  const [isGodMode, setIsGodMode] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  useEffect(() => {
    let progressInterval;
    if (pressTimer) {
      setProgress(0);
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 2;
        });
      }, 40); // 2 Sekunden für 100%
    }
    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [pressTimer]);

  const handlePressStart = (e) => {
    const timer = setTimeout(() => {
      setIsGodMode(true);
      onGodModeActivate();
      // Coole Animation wieder hinzufügen
      document.body.style.transition = 'all 0.5s ease';
      document.body.style.filter = 'brightness(1.5) contrast(1.2)';
      setTimeout(() => {
        document.body.style.filter = '';
      }, 500);
    }, 2000);
    setPressTimer(timer);
    
    // Progress-Animation starten
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 2;
      setProgress(progress);
      if (progress >= 100) {
        clearInterval(progressInterval);
      }
    }, 40);
  };

  const handlePressEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
      setProgress(0);
    }
  };

  const handleChange = (e) => {
    // Nur umschalten wenn kein Long-Press
    if (!pressTimer) {
      if (mode === 'lan') {
        setShowLoginDialog(true); // Zeige Login Dialog
      } else {
        onModeChange('lan');
      }
    }
  };

  return (
    <GodModeContainer data-godmode={isGodMode ? 'true' : 'false'}>
      <Box sx={{ position: 'relative' }}>
        {pressTimer && (
          <Box
            sx={{
              position: 'absolute',
              top: '-5px',
              left: '-5px',
              right: '-5px',
              bottom: '-5px',
              borderRadius: '25px',
              background: `conic-gradient(from 0deg at 50% 50%, #00ffff ${progress}%, transparent ${progress}%)`,
              opacity: 0.3,
              zIndex: -1
            }}
          />
        )}
        <NeonSwitch
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          checked={isGodMode ? true : mode === 'cloud'}
          onChange={handleChange}
          sx={{
            '& .MuiSwitch-switchBase': {
              '&.Mui-checked': {
                '& + .MuiSwitch-track': {
                  backgroundColor: isGodMode ? '#00ffff !important' : undefined,
                  opacity: isGodMode ? 1 : undefined,
                  boxShadow: isGodMode ? '0 0 20px #00ffff' : undefined
                }
              }
            }
          }}
        />
      </Box>
    </GodModeContainer>
  );
};

export default GodModeSwitch; 