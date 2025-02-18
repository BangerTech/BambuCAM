import { Box, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import logo from '../assets/logo.svg';
import logoSmall from '/logo512.png';
import { ConnectionToggle } from './ConnectionToggle';
import { AddPrinterButton } from './AddPrinterButton';

const StyledLogo = styled('img')({
  width: 'auto',
  objectFit: 'contain'
});

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
  const isExtraSmall = useMediaQuery('(max-width:375px)');

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isExtraSmall ? '8px' : isMobile ? '12px' : '16px',
      paddingTop: isMobile ? 'calc(env(safe-area-inset-top) + 8px)' : '16px',
      width: '100%',
      maxWidth: '100vw',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.9)',
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
        <StyledLogo 
          src={isMobile ? logoSmall : logo}
          alt="BambuCam"
          sx={{
            height: isExtraSmall ? '24px' : isMobile ? '30px' : '40px'
          }}
        />
      </Box>
      
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flex: '1 1 auto',
        transform: isMobile ? 'scale(0.85)' : 'none'
      }}>
        <StyledSwitch>
          <ConnectionToggle />
        </StyledSwitch>
      </Box>
      
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flex: '0 0 auto',
        marginRight: isExtraSmall ? '8px' : isMobile ? '12px' : '20px'
      }}>
        <AddPrinterButton 
          sx={{ 
            minWidth: isExtraSmall ? '24px' : isMobile ? '30px' : '40px',
            height: isExtraSmall ? '24px' : isMobile ? '30px' : '40px',
            padding: 0,
            '& svg': {
              width: isExtraSmall ? '16px' : isMobile ? '20px' : '24px',
              height: isExtraSmall ? '16px' : isMobile ? '20px' : '24px'
            }
          }} 
        />
      </Box>
    </Box>
  );
};

export default Header; 