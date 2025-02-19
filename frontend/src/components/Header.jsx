import React from 'react';
import { Box, useMediaQuery, useTheme, Button, Tooltip, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { styled } from '@mui/material/styles';
import GodModeSwitch from './GodModeSwitch';
import CloudLoginDialog from './CloudLoginDialog';

const Header = ({ onThemeToggle, isDarkMode, mode, onModeChange, onAddPrinter, onGodModeActivate, isGodMode }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isExtraSmall = useMediaQuery('(max-width:375px)');
  const [showLoginDialog, setShowLoginDialog] = React.useState(false);

  const handleGodModeActivate = () => {
    onGodModeActivate();
    setTimeout(() => {
      setShowLoginDialog(true);
    }, 800);
  };

  const handleLoginSuccess = (token) => {
    setShowLoginDialog(false);
    localStorage.setItem('cloudToken', token);
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
        marginLeft: isExtraSmall ? '8px' : isMobile ? '12px' : '20px'
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
        <Tooltip title={`Switch to ${mode === 'cloud' ? 'LAN' : 'Cloud'} Mode`}>
          <div>
            <GodModeSwitch
              mode={mode}
              onModeChange={onModeChange}
              onGodModeActivate={handleGodModeActivate}
            />
          </div>
        </Tooltip>
      </Box>
      
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flex: '0 0 auto',
        marginRight: isExtraSmall ? '8px' : isMobile ? '12px' : '20px'
      }}>
        {(mode === 'lan' || isGodMode) && (
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
      <CloudLoginDialog
        open={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        onSuccess={handleLoginSuccess}
        title="Enter God Mode"
      />
    </Box>
  );
};

export default Header; 