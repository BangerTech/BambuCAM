import React, { useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import PrinterGrid from './components/PrinterGrid';
import { lightTheme, darkTheme } from './theme';
import { Box, IconButton, Typography } from '@mui/material';
import styled from '@emotion/styled';
import CameraView from './components/CameraView';
import CameraOverlay from './components/CameraOverlay';
import RTSPStream from './components/RTSPStream';
import ControlsOverlay from './components/ControlsOverlay';
import DeleteIcon from '@mui/icons-material/Delete';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import FullscreenDialog from './components/FullscreenDialog';

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

  const [fullscreenPrinter, setFullscreenPrinter] = useState(null);

  // Fullscreen Handler
  const handleFullscreen = (printer, event) => {
    event.stopPropagation();
    setFullscreenPrinter(printer);
  };

  // Cleanup beim Schließen des Fullscreen
  const handleCloseFullscreen = () => {
    if (fullscreenPrinter) {
      setFullscreenPrinter(null);
    }
  };

  // Render der Kamera-Karte
  const renderCameraView = (printer, isFullscreen = false) => (
    <CameraView 
      elevation={3}
      onClick={() => isFullscreen ? handleCloseFullscreen() : setFullscreenPrinter(printer)}
      sx={{ cursor: 'pointer' }}
    >
      <CameraOverlay>
        <Typography variant="h6" sx={{ fontWeight: 500 }}>
          {printer.name}
        </Typography>
        {!isFullscreen ? (
          <IconButton
            onClick={(e) => handleFullscreen(printer, e)}
            sx={{ color: 'white' }}
          >
            <FullscreenIcon />
          </IconButton>
        ) : (
          <IconButton
            onClick={handleCloseFullscreen}
            sx={{ color: 'white' }}
          >
            <FullscreenExitIcon />
          </IconButton>
        )}
      </CameraOverlay>

      <RTSPStream 
        key={`${printer.id}-${isFullscreen ? 'fullscreen' : 'normal'}`} 
        url={printer.streamUrl} 
        wsPort={printer.wsPort}
      />

      {!isFullscreen && (
        <ControlsOverlay>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              handleDeletePrinter(printer.id);
            }}
            sx={{ color: 'white' }}
          >
            <DeleteIcon />
          </IconButton>
        </ControlsOverlay>
      )}
    </CameraView>
  );

  // Fullscreen Dialog
  <FullscreenDialog
    open={!!fullscreenPrinter}
    onClose={handleCloseFullscreen}
    fullScreen
  >
    <Box sx={{ height: '100%', position: 'relative' }}>
      {fullscreenPrinter && renderCameraView(fullscreenPrinter, true)}
    </Box>
  </FullscreenDialog>

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