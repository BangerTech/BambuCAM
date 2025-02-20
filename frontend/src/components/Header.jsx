import React, { useState, useEffect } from 'react';
import { Box, useMediaQuery, useTheme, Button, Tooltip, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudLoginDialog from './CloudLoginDialog';
import GodModeLoginDialog from './GodModeLoginDialog';
import GodModeBadge from './GodModeBadge';
import { NeonSwitch } from '../styles/NeonSwitch';

const Header = ({ onThemeToggle, isDarkMode, mode, onModeChange, onAddPrinter, onGodModeActivate, isGodMode }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isExtraSmall = useMediaQuery('(max-width:375px)');
  const [pressTimer, setPressTimer] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showLoginDialog, setShowLoginDialog] = React.useState(false);
  const [isGodModeLogin, setIsGodModeLogin] = useState(false);

  // Speichere den Progress-Status
  const progressRef = React.useRef(0);

  // Aktualisiere den Ref wenn sich Progress ändert
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  console.log('Header empfängt:', {
    onGodModeActivate: typeof onGodModeActivate,
    isGodMode
  });

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
      }, 40);
    }
    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [pressTimer]);

  const handlePressStart = (event) => {
    event.preventDefault();
    event.stopPropagation();

    console.log('Header: handlePressStart');
    // Starte den Timer für God Mode
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          // Timer abgelaufen
          if (!isGodMode) {
            console.log('God Mode Login wird angezeigt...');
            setIsGodModeLogin(true);
            setShowLoginDialog(true);
          }
          return 0;
        }
        return prev + 2;
      });
    }, 40);
    setPressTimer(timer);
  };

  const handlePressEnd = (event) => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
      event.preventDefault();
      event.stopPropagation();
    }
    // Nur Progress zurücksetzen wenn God Mode nicht aktiviert wurde
    if (progress < 100) {
      setProgress(0);
    }
  };

  const handleModeChange = (event) => {
    // Wenn Timer läuft oder Progress > 0, ignoriere den Mode-Wechsel
    if (pressTimer || progress > 0) {
      return;
    }
    
    if (mode === 'lan') {
      setShowLoginDialog(true);
      setIsGodModeLogin(false);
    } else {
      onModeChange('lan');
    }
  };

  const handleLoginSuccess = (token) => {
    setShowLoginDialog(false);
    localStorage.setItem('cloudToken', token);
    // Unterscheide zwischen God Mode und normalem Cloud Login
    if (isGodModeLogin) {
      console.log('God Mode Login erfolgreich!');
      // Aktiviere God Mode nach erfolgreichem Login
      if (typeof onGodModeActivate === 'function') {
        onGodModeActivate();
      }
    } else {
      console.log('Normaler Cloud Login erfolgreich!');
      onModeChange('cloud');
    }
  };

  const handleLongPress = () => {
    if (!isGodMode) {
      setIsGodModeLogin(true);
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isExtraSmall ? '8px' : isMobile ? '12px' : '16px',
      paddingTop: isMobile ? 'calc(env(safe-area-inset-top) + 16px)' : '24px',
      width: '100%',
      maxWidth: '100vw',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: 'transparent',
      zIndex: 1100,
      height: isMobile ? 'calc(env(safe-area-inset-top) + 50px)' : '70px',
      boxSizing: 'border-box',
      animation: isGodMode ? 'godModeHeaderGlow 2s infinite' : 'none',
      '@keyframes godModeHeaderGlow': {
        '0%': { borderColor: 'rgba(0, 255, 255, 0.2)' },
        '50%': { borderColor: 'rgba(0, 255, 255, 0.8)' },
        '100%': { borderColor: 'rgba(0, 255, 255, 0.2)' }
      }
    }}>
      <Box sx={{ 
        display: 'flex',
        alignItems: 'center',
        flex: '0 0 auto',
        marginLeft: isExtraSmall ? '8px' : isMobile ? '12px' : '20px',
      }}>
        <Tooltip title={`Toggle ${isDarkMode ? 'Light' : 'Dark'} Mode`} arrow>
          <img 
            src={`${process.env.PUBLIC_URL}/logo.png`}
            alt="BambuCam" 
            style={{
              height: isExtraSmall ? '24px' : isMobile ? '30px' : '40px',
              cursor: 'pointer',
              transition: 'transform 0.3s ease',
              transform: 'scale(1)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onClick={onThemeToggle}
          />
        </Tooltip>
      </Box>
      
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flex: '1 1 auto',
        transform: isMobile ? 'scale(0.85)' : 'none'
      }}>
        {isGodMode ? (
          <GodModeBadge />
        ) : (
          <Tooltip title={`Switch to ${mode === 'cloud' ? 'LAN' : 'Cloud'} Mode`}>
            <Box 
              sx={{ 
                position: 'relative',
                cursor: 'pointer'
              }}
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={handlePressStart}
              onTouchEnd={handlePressEnd}
            >
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
                  checked={mode === 'cloud'}
                  onChange={() => {
                    // Verhindere Mode-Änderung während des Long Press
                    if (!pressTimer) {
                      handleModeChange();
                    }
                  }}
                />
              </Box>
            </Box>
          </Tooltip>
        )}
      </Box>
      
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flex: '0 0 auto',
        marginRight: isExtraSmall ? '8px' : isMobile ? '12px' : '20px'
      }}>
        {/* Immer anzeigen im God Mode oder im LAN Mode */}
        {(isGodMode || mode === 'lan') && (
          <Button
            variant="contained"
            onClick={onAddPrinter}
            sx={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#00ffff',
              borderRadius: '1.5rem',
              textTransform: 'none',
              padding: '8px 24px',
              border: '0.15rem solid #00ffff',
              backdropFilter: 'blur(10px)',
              animation: isGodMode ? 'godModeButtonGlow 2s infinite' : 'none',
              '@keyframes godModeButtonGlow': {
                '0%': { boxShadow: '0 0 5px #00ffff' },
                '50%': { boxShadow: '0 0 15px #00ffff' },
                '100%': { boxShadow: '0 0 5px #00ffff' }
              },
              '&:hover': {
                boxShadow: '0 0 5rem rgba(0, 255, 255, 0.6)',
                background: 'rgba(0, 0, 0, 0.85)'
              },
              '& .hover-text': {
                display: 'none'
              },
              '&:hover .hover-text': {
                display: 'inline'
              }
            }}
          >
            + <span className="hover-text">ADD PRINTER</span>
          </Button>
        )}
      </Box>
      {isGodModeLogin ? (
        <GodModeLoginDialog
          open={showLoginDialog}
          onClose={() => {
            setShowLoginDialog(false);
            setIsGodModeLogin(false);
          }}
          onGodModeActivate={onGodModeActivate}
        />
      ) : (
        <CloudLoginDialog
          open={showLoginDialog}
          onClose={() => {
            setShowLoginDialog(false);
            setIsGodModeLogin(false);
          }}
          onLogin={handleLoginSuccess}
          title="Cloud Login"
        />
      )}
    </Box>
  );
};

export default Header; 