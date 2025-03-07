import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import PrinterGrid from './components/PrinterGrid';
import { lightTheme, darkTheme } from './theme';
import { Box } from '@mui/material';
import styled from '@emotion/styled';
import CloudLoginDialog from './components/CloudLoginDialog';
import CloudPrinterDialog from './components/CloudPrinterDialog';
import { API_URL } from './config';

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

  // Mode-Wechsel Handler
  const handleModeChange = async (newMode) => {
    try {
      if (newMode === 'cloud') {
        // Check cloud status first
        const response = await fetch(`${API_URL}/cloud/status?mode=${newMode}`);
        const status = await response.json();
        
        if (status.connected && status.token) {
          // Already logged in, just switch mode
          setMode('cloud');
          localStorage.setItem('mode', 'cloud');
          loadCloudPrinters(status.token);
        } else {
          // Need to login
          setLoginOpen(true);
        }
      } else {
        // Switching to LAN mode - tell backend to disconnect cloud
        await fetch(`${API_URL}/cloud/status?mode=lan`);
        setMode(newMode);
        localStorage.setItem('mode', newMode);
      }
    } catch (error) {
      console.error('Error changing mode:', error);
      setMode('lan');
      localStorage.setItem('mode', 'lan');
    }
  };

  // Initial mode check
  useEffect(() => {
    const checkInitialMode = async () => {
      const savedMode = localStorage.getItem('mode') || 'lan';
      
      if (savedMode === 'cloud') {
        try {
          const response = await fetch(`${API_URL}/cloud/status?mode=cloud`);
          const status = await response.json();
          
          if (status.connected && status.token) {
            setMode('cloud');
            loadCloudPrinters(status.token);
          } else {
            // Token invalid/expired, switch back to LAN
            await fetch(`${API_URL}/cloud/status?mode=lan`); // Disconnect cloud
            setMode('lan');
            localStorage.setItem('mode', 'lan');
          }
        } catch (error) {
          console.error('Error checking cloud status:', error);
          setMode('lan');
          localStorage.setItem('mode', 'lan');
        }
      } else {
        setMode(savedMode);
      }
    };
    
    checkInitialMode();
  }, []);

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
          <PrinterGrid 
            onThemeToggle={toggleTheme}
            isDarkMode={isDarkMode}
            mode={mode}
            onModeChange={handleModeChange}
            printers={mode === 'cloud' ? cloudPrinters : lanPrinters}
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