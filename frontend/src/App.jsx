import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useState } from 'react';
// ... andere imports ...

const App = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mode, setMode] = useState(() => localStorage.getItem('mode') || 'lan');
  const [isGodMode, setIsGodMode] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleGodModeActivate = () => {
    setIsGodMode(true);
    // Optional: Speichere God Mode Status
    localStorage.setItem('godMode', 'true');
  };

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleAddPrinter = () => {
    // Implementation of handleAddPrinter
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: '#000',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: isMobile ? '60px' : '80px', // Platz für Header
      paddingBottom: isMobile ? '80px' : '100px' // Platz für Bottom Buttons
    }}>
      <Header
        mode={mode}
        onModeChange={setMode}
        onGodModeActivate={handleGodModeActivate}
        isGodMode={isGodMode}
        isDarkMode={isDarkMode}
        onThemeToggle={handleThemeToggle}
        onAddPrinter={handleAddPrinter}
      />
      
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