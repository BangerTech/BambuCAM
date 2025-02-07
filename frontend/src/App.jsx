import { Box, useMediaQuery, useTheme } from '@mui/material';
// ... andere imports ...

const App = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: '#000',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: isMobile ? '60px' : '80px', // Platz für Header
      paddingBottom: isMobile ? '80px' : '100px' // Platz für Bottom Buttons
    }}>
      <Header />
      
      <Box sx={{ flex: 1 }}>
        <PrinterList />
      </Box>

      <Box sx={{
        position: 'fixed',
        bottom: isMobile ? 15 : 20,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 20px'
      }}>
        <SystemStatsButton />
        <NotificationButton />
      </Box>
    </Box>
  );
}; 