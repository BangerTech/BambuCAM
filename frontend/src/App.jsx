import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Box, useMediaQuery, useTheme } from '@mui/material';
import { lightTheme, darkTheme } from './theme';
import PrinterGrid from './components/PrinterGrid';
import SystemStatsButton from './components/SystemStatsButton';
import NotificationButton from './components/NotificationButton';
import CloudLoginDialog from './components/CloudLoginDialog';
import CloudPrinterDialog from './components/CloudPrinterDialog';
import AddPrinterDialog from './components/AddPrinterDialog';
import GodModeAddPrinterDialog from './components/GodModeAddPrinterDialog';
import Header from './components/Header';
import { API_URL } from './config';
import styled from '@emotion/styled';
// ... andere imports ...

if (window.appJsLoaded) {
  console.error('⚠️ Beide App-Dateien werden geladen! App.js und App.jsx');
}
window.appJsLoaded = true;

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

const App = () => {
  console.log('🔍 App.jsx wird ausgeführt');
  console.clear(); // Lösche alte Logs
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Logo vorausladen
  useEffect(() => {
    const img = new Image();
    img.src = `${process.env.PUBLIC_URL}/logo.png`;
  }, []);

  // States
  const [mode, setMode] = useState(() => localStorage.getItem('mode') || 'lan');
  const [isGodMode, setIsGodMode] = useState(() => localStorage.getItem('godMode') === 'true');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
  const [printers, setPrinters] = useState([]);
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [cloudPrinterDialogOpen, setCloudPrinterDialogOpen] = useState(false);
  const [availableCloudPrinters, setAvailableCloudPrinters] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showGodModeDialog, setShowGodModeDialog] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [scannedPrinters, setScannedPrinters] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanTimer, setScanTimer] = useState(10);

  // Definiere loadCombinedPrinters VOR handleGodModeActivate
  const loadCombinedPrinters = React.useCallback(async (token) => {
    try {
      console.log('Lade kombinierte Drucker...');
      // Lade LAN Drucker
      const lanResponse = await fetch(`${API_URL}/printers`);
      const lanPrinters = await lanResponse.json();
      console.log('LAN Drucker geladen:', lanPrinters.length);
      
      // Lade Cloud Drucker
      const cloudResponse = await fetch(`${API_URL}/cloud/printers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const cloudPrinters = await cloudResponse.json();
      console.log('Cloud Drucker geladen:', cloudPrinters.length);
      
      // Markiere die Drucker-Typen
      const markedLanPrinters = lanPrinters.map(p => ({ ...p, isCloud: false }));
      const markedCloudPrinters = cloudPrinters.map(p => ({ ...p, isCloud: true }));
      
      // Kombiniere und setze die Drucker
      setPrinters([...markedLanPrinters, ...markedCloudPrinters]);
      console.log('Drucker kombiniert:', markedLanPrinters.length + markedCloudPrinters.length);
    } catch (error) {
      console.error('❌ Fehler beim Laden der kombinierten Drucker:', error);
    }
  }, [setPrinters]);

  // Debug-Log für Initialisierung
  useEffect(() => {
    console.log('App wird initialisiert');
    console.log('App Initialisierung - isGodMode:', isGodMode);
  }, [isGodMode]);

  // Definiere handleGodModeActivate als normale Funktion statt useCallback
  const handleGodModeActivate = () => {
    console.log('🔮 handleGodModeActivate wird ausgeführt');
    console.log('Aktueller God Mode Status:', isGodMode);
    setIsGodMode(true);
    console.log('Neuer God Mode Status:', true);
    localStorage.setItem('godMode', 'true');
    
    // Wenn bereits ein Cloud-Token existiert, lade kombinierte Drucker
    const token = localStorage.getItem('cloudToken');
    if (token) {
      loadCombinedPrinters(token);
    }
  };

  // State-Updates in PrinterGrid überwachen
  useEffect(() => {
    console.log('God Mode Status in App:', isGodMode);
    // Aktualisiere auch PrinterGrid wenn sich der Status ändert
    if (isGodMode) {
      console.log('God Mode ist aktiv, aktualisiere UI...');
    }
  }, [isGodMode]);

  // Debug-Log für handleGodModeActivate
  console.log('handleGodModeActivate ist definiert:', {
    type: typeof handleGodModeActivate,
    isFunction: typeof handleGodModeActivate === 'function',
    isGodMode
  });

  // Modifiziere den existierenden Mode Change Handler
  const handleModeChange = async (newMode) => {
    if (newMode === 'cloud') {
      const token = localStorage.getItem('cloudToken');
      if (token) {
        // Wenn Token existiert, Cloud-Drucker laden
        setMode('cloud');
        localStorage.setItem('mode', 'cloud');
        loadCloudPrinters(token);
      } else {
        // Login-Dialog öffnen
        setLoginOpen(true);
      }
    } else {
      setMode('lan');
      localStorage.setItem('mode', 'lan');
      localStorage.removeItem('cloudToken');
    }
  };

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
  };

  // Angepasster AddPrinter Handler
  const handleAddPrinter = () => {
    console.log('Öffne Add Printer Dialog');
    if (isGodMode) {
      console.log('Öffne God Mode Add Printer Dialog');
      setShowGodModeDialog(true);
    } else {
      console.log('Öffne normalen Add Printer Dialog');
      setShowAddDialog(true);
    }
  };

  // Cloud Login Handler
  const handleCloudLogin = async (loginData) => {
    try {
      if (loginData.success && loginData.token) {
        localStorage.setItem('cloudToken', loginData.token);
        localStorage.setItem('mode', 'cloud');
        
        const response = await fetch(`${API_URL}/cloud/printers`, {
          headers: {
            'Authorization': `Bearer ${loginData.token}`
          }
        });
        
        if (response.ok) {
          const printers = await response.json();
          setAvailableCloudPrinters(printers.devices || []);
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
      window.dispatchEvent(new Event('cloud-login-failed'));
      // Bei Fehler zurück zu LAN
      setMode('lan');
      localStorage.setItem('mode', 'lan');
      localStorage.removeItem('cloudToken');
      throw error;
    }
  };

  // Cloud Printer Handler
  const handleAddCloudPrinter = (printer) => {
    setPrinters(prev => [...prev, { ...printer, isCloud: true }]);
    setCloudPrinterDialogOpen(false);
  };

  // Scan Handler
  const handleScan = async () => {
    try {
      setIsScanning(true);
      setScanTimer(10);
      console.log('Starte Scan...');
      
      const response = await fetch(`${API_URL}/scan`);
      const data = await response.json();
      
      if (data && Array.isArray(data.printers)) {
        setScannedPrinters(data.printers);
      }
    } catch (error) {
      console.error('Fehler beim Scannen:', error);
    } finally {
      setIsScanning(false);
    }
  };

  // God Mode Add Handler
  const handleGodModeAdd = async (printer) => {
    try {
      let endpoint = printer.isCloud ? '/cloud/printers' : '/printers';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(printer.isCloud && {
            'Authorization': `Bearer ${localStorage.getItem('cloudToken')}`
          })
        },
        body: JSON.stringify(printer)
      });

      if (response.ok) {
        setShowGodModeDialog(false);
      }
    } catch (error) {
      console.error('Error adding printer in God Mode:', error);
    }
  };

  // Initial Cloud-Drucker laden wenn im Cloud-Mode
  useEffect(() => {
    const token = localStorage.getItem('cloudToken');
    if (mode === 'cloud' && token) {
      loadCombinedPrinters(token);
    }
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
        const data = await response.json();
        setAvailableCloudPrinters(data.devices || []);
        setCloudPrinterDialogOpen(true);
      }
    } catch (error) {
      console.error('Error loading cloud printers:', error);
      setMode('lan');
      localStorage.setItem('mode', 'lan');
      localStorage.removeItem('cloudToken');
    }
  };

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <PageBackground>
        <BackgroundImage />
        <ContentWrapper>
          <PrinterGrid
            mode={mode}
            onModeChange={handleModeChange}
            printers={printers}
            onGodModeActivate={handleGodModeActivate}
            isGodMode={isGodMode}
            isDarkMode={isDarkMode}
            onThemeToggle={handleThemeToggle}
            onAddPrinter={handleAddPrinter}
            isMobile={isMobile}
          />

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
          
          <CloudLoginDialog
            open={isLoginOpen}
            onClose={() => setLoginOpen(false)}
            onLogin={handleCloudLogin}
          />
          
          <CloudPrinterDialog
            open={cloudPrinterDialogOpen}
            onClose={() => setCloudPrinterDialogOpen(false)}
            printers={availableCloudPrinters}
            onAddPrinter={handleAddCloudPrinter}
          />

          {/* Zeige den korrekten Dialog basierend auf God Mode */}
          {isGodMode ? (
            <GodModeAddPrinterDialog
              open={showGodModeDialog}
              onClose={() => setShowGodModeDialog(false)}
              onAdd={handleGodModeAdd}
            />
          ) : (
            <AddPrinterDialog 
              open={showAddDialog}
              onClose={() => setShowAddDialog(false)}
              onAdd={async (printer) => {
                try {
                  setIsAdding(true);
                  console.log('Sende Drucker an Backend:', printer);
                  
                  const response = await fetch(`${API_URL}/printers`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(printer)
                  });

                  if (!response.ok) {
                    throw new Error('Failed to add printer');
                  }

                  const data = await response.json();
                  console.log('Drucker erfolgreich hinzugefügt:', data);
                  
                  // Aktualisiere die Drucker-Liste
                  setPrinters(prev => [...prev, data]);
                  setShowAddDialog(false);
                } catch (error) {
                  console.error('Fehler beim Hinzufügen des Druckers:', error);
                } finally {
                  setIsAdding(false);
                }
              }}
              isAdding={isAdding}
              isDarkMode={isDarkMode}
              scannedPrinters={scannedPrinters}
              isScanning={isScanning}
              scanTimer={scanTimer}
              onScan={handleScan}
            />
          )}
        </ContentWrapper>
      </PageBackground>
    </ThemeProvider>
  );
};

// Debug-Log für Export
console.log('App wird exportiert');

export default App; 