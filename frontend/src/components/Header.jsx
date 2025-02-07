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
  const isExtraSmall = useMediaQuery('(max-width:425px)');

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isExtraSmall ? '10px' : isMobile ? '10px 15px' : '20px',
      width: '100%',
      maxWidth: '100vw',  // Verhindert Overflow
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.9)',
      zIndex: 1000,
      '& > *': {  // Gleichmäßige Verteilung der Elemente
        flex: isExtraSmall ? '0 1 auto' : 1,
        textAlign: 'center'
      }
    }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'flex-start',
        flex: isExtraSmall ? '0 0 auto' : 1,
        marginRight: isExtraSmall ? '10px' : '20px'
      }}>
        <Logo src="/logo.png" alt="BambuCam" />
      </Box>
      
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center',
        flex: isExtraSmall ? '1 1 auto' : 1
      }}>
        <StyledSwitch>
          <ConnectionToggle />
        </StyledSwitch>
      </Box>
      
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'flex-end',
        flex: isExtraSmall ? '0 0 auto' : 1
      }}>
        <AddPrinterButton 
          sx={{ 
            transform: isExtraSmall ? 'scale(0.7)' : isMobile ? 'scale(0.8)' : 'none',
            minWidth: isExtraSmall ? '25px' : isMobile ? '30px' : '40px',
            height: isExtraSmall ? '25px' : isMobile ? '30px' : '40px'
          }} 
        />
      </Box>
    </Box>
  );
};

export default Header; 