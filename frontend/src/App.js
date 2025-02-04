import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import PrinterGrid from './components/PrinterGrid';
import { lightTheme, darkTheme } from './theme';
import { Box } from '@mui/material';
import styled from '@emotion/styled';
import CloudLoginDialog from './components/CloudLoginDialog';

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

// Dynamische API_URL basierend auf dem aktuellen Host
const API_URL = `${window.location.protocol}//${window.location.hostname}:4000`;

function App() {
  // Theme aus localStorage laden
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Mode aus localStorage laden
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('mode');
    const hasToken = localStorage.getItem('cloudToken');
    // Wenn Cloud-Mode gespeichert ist und ein Token existiert
    if (savedMode === 'cloud' && hasToken) {
      return 'cloud';
    }
    return 'lan';
  });

  const [isLoginOpen, setLoginOpen] = useState(false);
  const [cloudPrinters, setCloudPrinters] = useState([]);
  const [lanPrinters, setLanPrinters] = useState([]);
  const [addPrinterDialogOpen, setAddPrinterDialogOpen] = useState(false);

  // Lade LAN Drucker
  useEffect(() => {
    let isMounted = true;  // Prevent memory leak

    if (mode === 'lan') {
      fetch(`${API_URL}/printers`)
        .then(res => res.json())
        .then(data => {
          if (isMounted) {
            setLanPrinters(data);
          }
        })
        .catch(err => console.error('Error loading LAN printers:', err));
    }

    return () => {
      isMounted = false;  // Cleanup
    };
  }, [mode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
  };

  // Mode-Änderung mit localStorage
  const handleModeChange = (newMode) => {
    if (newMode === 'cloud') {
      const token = localStorage.getItem('cloudToken');
      if (token) {
        setMode('cloud');
        localStorage.setItem('mode', 'cloud');
        // Cloud-Drucker laden
        loadCloudPrinters(token);
      } else {
        setLoginOpen(true);
      }
    } else {
      setMode('lan');
      localStorage.setItem('mode', 'lan');
      // Optional: Cloud-Token löschen beim Wechsel zu LAN
      localStorage.removeItem('cloudToken');
    }
  };

  // Cloud-Drucker laden
  const loadCloudPrinters = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/cloud/printers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const printers = await response.json();
        setCloudPrinters(printers);
      }
    } catch (error) {
      console.error('Error loading cloud printers:', error);
      // Bei Fehler zurück zu LAN
      setMode('lan');
      localStorage.setItem('mode', 'lan');
      localStorage.removeItem('cloudToken');
    }
  };

  // Initial Cloud-Drucker laden wenn im Cloud-Mode
  useEffect(() => {
    const token = localStorage.getItem('cloudToken');
    if (mode === 'cloud' && token) {
      loadCloudPrinters(token);
    }
  }, []);

  // Cloud Login Handler
  const handleCloudLogin = async (loginData) => {
    try {
      if (loginData.success && loginData.token) {
        // Token speichern
        localStorage.setItem('cloudToken', loginData.token);
        
        // Hole Cloud-Drucker
        const response = await fetch(`${API_URL}/api/cloud/printers`, {
          headers: {
            'Authorization': `Bearer ${loginData.token}`
          }
        });
        if (response.ok) {
          const printers = await response.json();
          setCloudPrinters(printers);
          setMode('cloud');
          localStorage.setItem('mode', 'cloud'); // Mode speichern
          setLoginOpen(false);
        } else {
          throw new Error('Fehler beim Laden der Cloud-Drucker');
        }
      } else {
        throw new Error(loginData.error || 'Login fehlgeschlagen');
      }
    } catch (error) {
      console.error('Cloud login error:', error);
      throw error;
    }
  };

  const handleAddPrinter = () => {
    // Öffne den AddPrinterDialog
    setAddPrinterDialogOpen(true);
  };

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <PageBackground>
        <BackgroundImage />
        <ContentWrapper>
          <PrinterGrid 
            onThemeToggle={toggleTheme}
            isDarkMode={isDarkMode}
            mode={mode}
            onModeChange={handleModeChange}
          />
        </ContentWrapper>
      </PageBackground>

      <CloudLoginDialog
        open={isLoginOpen}
        onClose={() => setLoginOpen(false)}
        onLogin={handleCloudLogin}
      />
    </ThemeProvider>
  );
}

export default App; 