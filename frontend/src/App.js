import React, { useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import PrinterGrid from './components/PrinterGrid';
import { lightTheme, darkTheme } from './theme';
import { Box } from '@mui/material';
import styled from '@emotion/styled';

const PageBackground = styled(Box)(({ theme }) => ({
  position: 'relative',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default
}));

const BackgroundImage = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: `url('${process.env.PUBLIC_URL}/background.png') center center fixed`,
  backgroundSize: 'contain',
  backgroundRepeat: 'no-repeat',
  opacity: theme.palette.mode === 'dark' ? 0.03 : 0.05,
  zIndex: 0
}));

const ContentWrapper = styled(Box)({
  position: 'relative',
  zIndex: 1,
  padding: 24
});

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // Optional: Theme in localStorage speichern
    localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
  };

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <CssBaseline /> {/* Reset CSS und Theme Basics */}
      <PageBackground>
        <BackgroundImage />
        <ContentWrapper>
          <PrinterGrid onThemeToggle={toggleTheme} isDarkMode={isDarkMode} />
        </ContentWrapper>
      </PageBackground>
    </ThemeProvider>
  );
}

export default App; 