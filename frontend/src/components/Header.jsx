import React from 'react';
import { Box, useMediaQuery, useTheme, Button, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { NeonSwitch } from '../styles/NeonSwitch';

const Header = ({ onThemeToggle, isDarkMode, mode, onModeChange, onAddPrinter }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isExtraSmall = useMediaQuery('(max-width:375px)');

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
      boxSizing: 'border-box'
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
            <NeonSwitch
              checked={mode === 'cloud'}
              onChange={(e) => onModeChange(e.target.checked ? 'cloud' : 'lan')}
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
            boxShadow: '0 0 2rem rgba(0, 255, 255, 0.3)',
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
      </Box>
    </Box>
  );
};

export default Header; 