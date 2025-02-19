import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import PrinterGrid from './components/PrinterGrid';
import { lightTheme, darkTheme } from './theme';
import { Box } from '@mui/material';
import styled from '@emotion/styled';
import CloudLoginDialog from './components/CloudLoginDialog';
import CloudPrinterDialog from './components/CloudPrinterDialog';
import { API_URL } from './config';
import Header from './components/Header';

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
  // Theme aus localStorage laden
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Mode aus localStorage laden
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('mode');
    const hasToken = localStorage.getItem('cloudToken');
    return savedMode === 'cloud' && hasToken ? 'cloud' : 'lan';
  });

  // Neuer God Mode State
  const [isGodMode, setIsGodMode] = useState(() => {
    return localStorage.getItem('godMode') === 'true';
  });

  // Kombinierte Drucker für God Mode
  const [combinedPrinters, setCombinedPrinters] = useState([]);

  const [isLoginOpen, setLoginOpen] = useState(false);
  const [cloudPrinters, setCloudPrinters] = useState([]);
  const [lanPrinters, setLanPrinters] = useState([]);
  const [addPrinterDialogOpen, setAddPrinterDialogOpen] = useState(false);
  const [cloudPrinterDialogOpen, setCloudPrinterDialogOpen] = useState(false);
  const [availableCloudPrinters, setAvailableCloudPrinters] = useState([]);
  const [selectedCloudPrinters, setSelectedCloudPrinters] = useState([]);

  // Lade LAN Drucker
  useEffect(() => {
    let isMounted = true;

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
        isMounted = false;
    };
}, [mode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
  };

  // God Mode Handler
  const handleGodModeActivate = async () => {
    setIsGodMode(true);
    localStorage.setItem('godMode', 'true');
    
    // Wenn bereits ein Cloud-Token existiert, lade kombinierte Drucker
    const token = localStorage.getItem('cloudToken');
    if (token) {
      await loadCombinedPrinters(token);
    }
  };

  // Lade kombinierte Drucker für God Mode
  const loadCombinedPrinters = async (token) => {
    try {
      // Lade LAN Drucker
      const lanResponse = await fetch(`${API_URL}/printers`);
      const lanPrinters = await lanResponse.json();
      
      // Lade Cloud Drucker
      const cloudResponse = await fetch(`${API_URL}/cloud/printers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const cloudPrinters = await cloudResponse.json();
      
      // Markiere die Drucker-Typen
      const markedLanPrinters = lanPrinters.map(p => ({ ...p, isCloud: false }));
      const markedCloudPrinters = cloudPrinters.map(p => ({ ...p, isCloud: true }));
      
      // Kombiniere und setze die Drucker
      setCombinedPrinters([...markedLanPrinters, ...markedCloudPrinters]);
    } catch (error) {
      console.error('Error loading combined printers:', error);
    }
  };

  // Modifiziere den existierenden Mode Change Handler
  const handleModeChange = (newMode) => {
    if (isGodMode) return; // Ignoriere Mode-Änderungen im God Mode
    setMode(newMode);
    localStorage.setItem('mode', newMode);
  };

  // Cloud-Drucker laden
  const loadCloudPrinters = async (token) => {
    try {
      const response = await fetch(`${API_URL}/cloud/printers`, {
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
        localStorage.setItem('cloudToken', loginData.token);
        
        const response = await fetch(`${API_URL}/cloud/printers`, {
          headers: {
            'Authorization': `Bearer ${loginData.token}`
          }
        });
        
        if (response.ok) {
          const printers = await response.json();
          setAvailableCloudPrinters(printers);
          localStorage.setItem('mode', 'cloud');
          setLoginOpen(false);
          setCloudPrinterDialogOpen(true);
          // Login erfolgreich Event
          window.dispatchEvent(new Event('cloud-login-success'));
        } else {
          throw new Error('Fehler beim Laden der Cloud-Drucker');
        }
      }
    } catch (error) {
      console.error('Cloud login error:', error);
      // Login fehlgeschlagen Event
      window.dispatchEvent(new Event('cloud-login-failed'));
      throw error;
    }
  };

  const handleAddPrinter = () => {
    // Öffne den AddPrinterDialog
    setAddPrinterDialogOpen(true);
  };

  const handleAddCloudPrinter = (printer) => {
    setSelectedCloudPrinters(prev => [...prev, printer]);
    setCloudPrinters(prev => [...prev, printer]);
  };

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <PageBackground>
        <BackgroundImage />
        <ContentWrapper>
          <Header
            onThemeToggle={toggleTheme}
            isDarkMode={isDarkMode}
            mode={mode}
            onModeChange={handleModeChange}
            onGodModeActivate={handleGodModeActivate}
            isGodMode={isGodMode}
          />
          <PrinterGrid
            printers={isGodMode ? combinedPrinters : (mode === 'cloud' ? cloudPrinters : lanPrinters)}
            mode={mode}
            isGodMode={isGodMode}
            onModeChange={handleModeChange}
            isDarkMode={isDarkMode}
            onThemeToggle={toggleTheme}
            onAddPrinter={handleAddPrinter}
          />
        </ContentWrapper>
      </PageBackground>

      <CloudLoginDialog
        open={isLoginOpen}
        onClose={() => setLoginOpen(false)}
        onLogin={handleCloudLogin}
      />

      {/* Cloud Drucker Auswahl Dialog */}
      <CloudPrinterDialog
        open={cloudPrinterDialogOpen}
        onClose={() => setCloudPrinterDialogOpen(false)}
        printers={availableCloudPrinters}
        onAddPrinter={(printer) => {
          handleAddCloudPrinter(printer);
          setCloudPrinterDialogOpen(false);
        }}
      />
    </ThemeProvider>
  );
}

export default App; 