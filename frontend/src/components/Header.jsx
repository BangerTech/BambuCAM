import { Box, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';

const Logo = styled('img')(({ theme }) => ({
  height: '40px',
  [theme.breakpoints.down('sm')]: {  // < 600px
    height: '25px'
  },
  '@media (max-width: 425px)': {     // Extra small devices
    height: '20px'
  }
}));

const StyledSwitch = styled('div')(({ theme }) => ({
  fontSize: '1.2rem',
  [theme.breakpoints.down('sm')]: {
    fontSize: '0.9rem',
    transform: 'scale(0.8)'
  }
}));

const Header = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '10px 15px' : '20px',
      width: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.9)',
      zIndex: 1000
    }}>
      <Logo src="/logo.png" alt="BambuCam" />
      
      <StyledSwitch>
        <ConnectionToggle />
      </StyledSwitch>
      
      <AddPrinterButton 
        sx={{ 
          transform: isMobile ? 'scale(0.8)' : 'none',
          minWidth: isMobile ? '30px' : '40px',
          height: isMobile ? '30px' : '40px'
        }} 
      />
    </Box>
  );
};

export default Header; 