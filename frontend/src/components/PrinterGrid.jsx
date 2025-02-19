import React, { useState, useEffect } from 'react';
import { Grid, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography, Box, List, ListItem, ListItemText, IconButton, CircularProgress, Chip, Divider, Collapse, Snackbar, Alert, LinearProgress, FormControlLabel, SpeedDial, SpeedDialIcon, SpeedDialAction, Tooltip } from '@mui/material';
import RTSPStream from './RTSPStream';
import DeleteIcon from '@mui/icons-material/Delete';
import '../styles/NeonButton.css';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import { NeonSwitch } from '../styles/NeonSwitch.js';
import RouterIcon from '@mui/icons-material/Router';
import CloudIcon from '@mui/icons-material/Cloud';
import AddIcon from '@mui/icons-material/Add';
import FullscreenDialog from './FullscreenDialog';
import PrinterCard from './PrinterCard';
import NotificationButton from './NotificationButton';
import { showNotification } from '../services/notificationService';
import SystemStatsButton from './SystemStatsButton';
import SystemStatsDialog from './SystemStatsDialog';
import { API_URL } from '../config';
import AddPrinterDialog from './AddPrinterDialog';
import { printerApi } from '../api/printerApi';
import { Logger, LOG_CATEGORIES } from '../utils/logger';

console.log('Using API URL:', API_URL);  // Debug log

const PrinterGrid = ({ onThemeToggle, isDarkMode, mode, onModeChange, printers = [] }) => {
  // State Definitionen
  const [open, setOpen] = useState(false);
  const [addMethod, setAddMethod] = useState(0);
  const [newPrinter, setNewPrinter] = useState({ name: '', ip: '', accessCode: '' });
  const [scannedPrinters, setScannedPrinters] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isAdding, setIsAdding] = useState(false);  // isAdding State hinzufügen
  const [fullscreenPrinter, setFullscreenPrinter] = useState(null);
  const [error, setError] = useState(null);  // Error State hinzufügen
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [showGuide, setShowGuide] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);

  // Stelle sicher, dass printers immer ein Array ist
  const printerList = Array.isArray(printers) ? printers : [];
  const [localPrinters, setLocalPrinters] = useState([]);
  const [cloudPrinters, setCloudPrinters] = useState([]);
  
  // Bestimme welche Drucker angezeigt werden sollen
  const displayPrinters = mode === 'cloud' ? cloudPrinters : localPrinters;
  
  // Speichere Drucker bei Änderungen
  useEffect(() => {
    localStorage.setItem('printers', JSON.stringify(localPrinters));
  }, [localPrinters]);

  // Lade Drucker und ihre Positionen
  useEffect(() => {
    let isMounted = true;

    const loadPrinters = async () => {
      try {
        const response = await fetch(`${API_URL}/printers`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setLocalPrinters(data);
        setError(null);  // Fehler zurücksetzen wenn erfolgreich
      } catch (err) {
        console.error('Error loading printers:', err);
        setError(err.message);
        setSnackbar({
          open: true,
          message: 'Failed to load printers',
          severity: 'error'
        });
      }
    };

    loadPrinters();

    return () => {
      isMounted = false;
    };
  }, []); // Nur beim ersten Laden ausführen

  // Lade Cloud-Drucker
  useEffect(() => {
    const fetchCloudPrinters = async () => {
      try {
        const response = await fetch(`${API_URL}/api/cloud/printers`);
        const data = await response.json();
        if (data.message === "success" && data.devices && Array.isArray(data.devices)) {
          // Konvertiere Cloud-Drucker in das gleiche Format wie lokale Drucker
          const formattedPrinters = data.devices.map(printer => ({
            id: printer.dev_id,
            name: printer.name,
            ip: 'cloud',
            type: 'bambulab',
            model: printer.dev_product_name,
            status: printer.online ? 'online' : 'offline',
            accessCode: printer.dev_access_code,
            nozzle_diameter: printer.nozzle_diameter,
            print_status: printer.print_status,
            dev_structure: printer.dev_structure,
            isCloud: true
          }));
          console.log('Formatted cloud printers:', formattedPrinters);
          setCloudPrinters(formattedPrinters);
        }
      } catch (error) {
        console.error('Error fetching cloud printers:', error);
      }
    };

    if (mode === 'cloud') {
      fetchCloudPrinters();
    }
  }, [mode]);

  const [scanTimer, setScanTimer] = useState(10);
  const [foundPrinters, setFoundPrinters] = useState([]);
  const [printerStatus, setPrinterStatus] = useState({});

  // Status-Polling für alle Drucker
  useEffect(() => {
    const updatePrinterStatus = async () => {
      for (const printer of localPrinters) {
        try {
          const data = await printerApi.fetchStatus(printer.id);
          setPrinterStatus(prev => ({
            ...prev,
            [printer.id]: data
          }));
        } catch (error) {
          Logger.error('Error updating printer status:', error);
        }
      }
    };

    if (localPrinters.length > 0) {
      updatePrinterStatus();
      const interval = setInterval(updatePrinterStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [localPrinters]);

  // Kombiniere Drucker mit ihrem Status
  const printersWithStatus = localPrinters.map(printer => ({
    ...printer,
    ...printerStatus[printer.id]
  }));

  // Funktion zum Aktualisieren der Positionen
  const updatePrinterOrder = (printers) => {
    const orderMap = {};
    printers.forEach((printer, index) => {
      orderMap[printer.id] = index;
    });
    localStorage.setItem('printerOrder', JSON.stringify(orderMap));
  };

  // Modifizierte handleAddPrinter Funktion
  const handleAddPrinter = async (printer) => {
    setIsAdding(true);
    try {
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
        setLocalPrinters([...localPrinters, data.printer]);
        setOpen(false);
        setNewPrinter({ name: '', ip: '', accessCode: '' });
        
        setSnackbar({
            open: true,
            message: 'Printer added successfully',
            severity: 'success'
        });
    } catch (err) {
        console.error('Error adding printer:', err);
        setSnackbar({
            open: true,
            message: 'Failed to add printer',
            severity: 'error'
        });
    } finally {
        setIsAdding(false);
    }
  };

  const handleScan = async () => {
    try {
      setIsScanning(true);
      setScanTimer(10);
      console.log('Starte Scan...');
      
      // Timer UI updaten
      const timer = setInterval(() => {
        setScanTimer(prev => prev - 1);
      }, 1000);

      // Timeout nach 10 Sekunden
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          clearInterval(timer);
          reject(new Error('Scan timeout'));
        }, 10000);
      });
      
      // Race zwischen Scan und Timeout
      const response = await Promise.race([
        fetch(`${API_URL}/scan`),
        timeoutPromise
      ]);

      console.log('Scan Response:', response);
      
      const data = await response.json();
      console.log('Gefundene Drucker:', data);
      
      if (data && Array.isArray(data.printers)) {
        setScannedPrinters(data.printers);
        setSnackbar({
          open: true,
          message: `Found ${data.printers.length} printer(s)`,
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Fehler beim Scannen:', error);
      setSnackbar({
        open: true,
        message: error.message === 'Scan timeout' ? 
          'Scan timeout after 10 seconds' : 
          'Error scanning for printers',
        severity: 'error'
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleFullscreenToggle = (printer) => {
    setFullscreenPrinter(fullscreenPrinter ? null : printer);
  };

  // Modifizierte handleDelete Funktion
  const handleDelete = async (printerId) => {
    try {
      console.log('Lösche Drucker mit ID:', printerId);
      
      // Erst den Stream stoppen
      try {
        await fetch(`${API_URL}/stream/${printerId}/stop`, {
          method: 'POST'
        });
      } catch (e) {
        console.warn('Error stopping stream:', e);
      }
      
      // Dann den Drucker löschen
      const response = await fetch(`${API_URL}/printers/${printerId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const updatedPrinters = localPrinters.filter(p => p.id !== printerId);
        setLocalPrinters(updatedPrinters);
        // Aktualisiere Positionen nach Löschung
        updatePrinterOrder(updatedPrinters);
        
        setSnackbar({
          open: true,
          message: 'Printer deleted successfully',
          severity: 'success'
        });
      } else {
        throw new Error('Failed to delete printer');
      }
    } catch (error) {
      console.error('Error deleting printer:', error);
      setSnackbar({
        open: true,
        message: 'Error deleting printer',
        severity: 'error'
      });
    }
  };

  // Aktualisierte onDragEnd Funktion
  const onDragEnd = (result) => {
    if (!result.destination || mode === 'cloud') return;  // Verhindere Drag & Drop im Cloud-Modus
    
    const items = Array.from(localPrinters);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Speichere die neue Reihenfolge
    const orderMap = {};
    items.forEach((printer, index) => {
      orderMap[printer.id] = index;
    });
    
    localStorage.setItem('printerOrder', JSON.stringify(orderMap));
    setLocalPrinters(items);
  };

  const handleClose = () => {
    setOpen(false);
    setNewPrinter({ name: '', ip: '', accessCode: '' });
  };

  // Status-Anzeige Funktionen
  const getTemperature = (printer, type) => {
    if (!printer) return '-.--';

    try {
      const temps = printerStatus[printer.id]?.temperatures;
      if (!temps) return '-.--';
      
      // Unterscheide zwischen Bambulab und Creality
      if (printer.type === 'BAMBULAB') {
        switch(type) {
          case 'nozzle':
            return temps.nozzle?.toFixed(1) || '-.--';
          case 'bed':
            return temps.bed?.toFixed(1) || '-.--';
          case 'chamber':
            return temps.chamber?.toFixed(1) || '-.--';
          default:
            return '-.--';
        }
      } else if (printer.type === 'CREALITY') {
        switch(type) {
          case 'nozzle':
            return temps.hotend?.toFixed(1) || '-.--';  // Creality nutzt 'hotend' statt 'nozzle'
          case 'bed':
            return temps.bed?.toFixed(1) || '-.--';
          case 'chamber':
            return temps.chamber?.toFixed(1) || '-.--';
          default:
            return '-.--';
        }
      }
    } catch (e) {
      return '-.--';
    }
  };

  const getPrintStatus = (printer) => {
    if (printer.type === 'BAMBULAB') {
      if (printer.isCloud) {
        return {
          text: printer.print_status || 'Unknown',
          color: printer.online ? '#4caf50' : '#9e9e9e'
        };
      }
      // Original Bambulab Status-Logik
      const status = printerStatus[printer.id]?.status?.toLowerCase() || 'unknown';
      
      switch(status.toLowerCase()) {
        case 'running':  // MQTT sendet "RUNNING" statt "printing"
          return { text: 'Printing', color: '#4caf50' };
        case 'ready':    // Drucker ist bereit aber inaktiv
          return { text: 'Ready', color: '#2196f3' };
        case 'idle':
          return { text: 'Idle', color: '#2196f3' };
        case 'paused':
          return { text: 'Paused', color: '#ff9800' };
        case 'finished':
          return { text: 'Finished', color: '#4caf50' };
        case 'error':
          return { text: 'Error', color: '#f44336' };
        case 'offline':
          return { text: 'Offline', color: '#9e9e9e' };
        case 'unknown':
          return { text: 'Connecting...', color: '#9e9e9e' };
        default:
          return { text: status, color: '#9e9e9e' };
      }
    } else if (printer.type === 'CREALITY') {
      const status = printerStatus[printer.id]?.state?.toLowerCase() || 'unknown';
      
      switch(status) {
        case 'standby':
          return { text: 'Ready', color: '#2196f3' };
        case 'printing':
          return { text: 'Printing', color: '#4caf50' };
        case 'paused':
          return { text: 'Paused', color: '#ff9800' };
        case 'complete':
          return { text: 'Finished', color: '#4caf50' };
        case 'error':
          return { text: 'Error', color: '#f44336' };
        case 'offline':
          return { text: 'Offline', color: '#9e9e9e' };
        default:
          return { text: status, color: '#9e9e9e' };
      }
    }
  };

  const getPrintProgress = (printer) => {
    try {
      return printerStatus[printer.id]?.progress || 0;
    } catch (e) {
      return 0;
    }
  };

  const getRemainingTime = (printer) => {
    try {
      const remaining = printerStatus[printer.id]?.printTime?.remaining;
      if (!remaining || remaining <= 0) return null;
      
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    } catch (e) {
      return null;
    }
  };

  const handleAddScannedPrinter = async (printer) => {
    try {
      const printerData = {
        name: printer.name,
        ip: printer.ip,
        accessCode: '', // Muss vom Benutzer eingegeben werden
      };
      
      // Öffne Dialog für Access Code
      const accessCode = window.prompt('Bitte geben Sie den Access Code ein:');
      if (!accessCode) return;
      
      printerData.accessCode = accessCode;
      
      await handleAddPrinter(printerData);
    } catch (error) {
      console.error('Fehler beim Hinzufügen des gescannten Druckers:', error);
    }
  };

  // Fullscreen card styles
  const fullscreenStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1300,
    backgroundColor: 'white',
    padding: '20px',
    overflow: 'auto'
  };

  // Regular grid styles
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    padding: '20px'
  };

  // Überwache Statusänderungen für Benachrichtigungen
  useEffect(() => {
    // Prüfe ob printers ein Array ist und nicht null/undefined
    if (Array.isArray(printers)) {
        printers.forEach(printer => {
            if (['failed', 'error', 'finished'].includes(printer.status)) {
                showNotification(printer, printer.status);
            }
        });
    }
  }, [printers]);

  // Status-Management für alle Drucker
  const getPrinterWithStatus = (printer) => {
    const status = printerStatus[printer.id];
    if (!status) {
      return { ...printer, status: 'connecting' };
    }
    return {
      ...printer,
      status: status.status || 'offline',
      temperatures: status.temperatures || { nozzle: 0, bed: 0, chamber: 0 },
      progress: status.progress,
      remaining_time: status.remaining_time
    };
  };

  if (fullscreenPrinter) {
    const printerWithStatus = getPrinterWithStatus(fullscreenPrinter);
    return (
      <div style={fullscreenStyle}>
        <IconButton 
          onClick={() => handleFullscreenToggle(null)}
          style={{ position: 'absolute', top: 10, right: 10 }}
        >
          <CloseIcon />
        </IconButton>
        <PrinterCard 
          printer={printerWithStatus}  // Übergebe Drucker mit Status
          onRemove={handleDelete}
          isFullscreen={true}
          onFullscreenToggle={handleFullscreenToggle}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        {/* Logo mit onClick */}
        <img 
          src={`${process.env.PUBLIC_URL}/logo.png`}
          alt="BambuCam" 
          style={{
            height: '40px',
            cursor: 'pointer',
            transition: 'transform 0.3s ease',
            transform: 'scale(1)'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onClick={onThemeToggle}
          title={`Click to switch to ${isDarkMode ? 'Light' : 'Dark'} Mode`}
        />

        {/* Cloud/LAN Switch in der Mitte */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          flex: 1
        }}>
          <Tooltip title={`Switch to ${mode === 'cloud' ? 'LAN' : 'Cloud'} Mode`}>
            <div>  {/* Wrapper div needed for Tooltip to work with custom component */}
              <NeonSwitch
                checked={mode === 'cloud'}
                onChange={(e) => onModeChange(e.target.checked ? 'cloud' : 'lan')}
              />
            </div>
          </Tooltip>
        </div>
        
        {/* Neon Button nur im LAN-Mode anzeigen */}
        {mode === 'lan' && (
          <Button
            variant="contained"
            onClick={() => setOpen(true)}
            sx={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#00ffff',
              borderRadius: '1.5rem',
              textTransform: 'none',
              padding: '8px 24px',
              border: '0.15rem solid #00ffff',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 0 2rem rgba(0, 255, 255, 0.3)',
              '&:hover': {
                boxShadow: '0 0 5rem rgba(0, 255, 255, 0.6)',
                background: 'rgba(0, 0, 0, 0.85)'
              },
              '& .hover-text': {
                display: 'none'
              },
              '&:hover .hover-text': {
                display: 'inline'
              }
            }}
          >
            + <span className="hover-text">ADD PRINTER</span>
          </Button>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="printers" direction="horizontal">
          {(provided) => (
            <Grid container spacing={3} {...provided.droppableProps} ref={provided.innerRef}>
              {displayPrinters.map((printer, index) => {
                const printerWithStatus = getPrinterWithStatus(printer);
                const dragId = printerWithStatus.id?.toString() || `printer-${index}`;
                
                return (
                  <Draggable
                    key={dragId}
                    draggableId={dragId}
                    index={index}
                    isDragDisabled={mode === 'cloud'}  // Deaktiviere Drag im Cloud-Modus
                  >
                    {(provided, snapshot) => (
                      <Grid item xs={12} sm={12} md={6} lg={6}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          ...provided.draggableProps.style,
                          cursor: mode === 'cloud' ? 'default' : 'grab',
                          opacity: snapshot.isDragging ? 0.8 : 1,
                          zIndex: snapshot.isDragging ? 100 : 1
                        }}
                      >
                        <Paper 
                          sx={{ 
                            position: 'relative',
                            height: 0,
                            paddingBottom: 'calc(56.25% + 72px)',  // 16:9 (56.25%) + Header(32px) + Footer(40px)
                            borderRadius: '15px',
                            overflow: 'hidden',
                            background: '#000',
                            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          {/* Header */}
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '32px',
                            padding: '8px',
                            background: 'rgba(0,0,0,0.7)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            color: 'white',
                            zIndex: 2
                          }}>
                            <Typography variant="subtitle1">{printerWithStatus.name}</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <IconButton size="small" sx={{ color: 'white' }} onClick={() => handleFullscreenToggle(printerWithStatus)}>
                                <FullscreenIcon />
                              </IconButton>
                              <IconButton size="small" sx={{ color: 'white' }} onClick={() => handleDelete(printerWithStatus.id)}>
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                          </Box>

                          {/* Video Stream */}
                          <Box sx={{
                            position: 'absolute',
                            top: '32px',
                            left: 0,
                            right: 0,
                            bottom: '40px',
                            background: '#000'
                          }}>
                            <RTSPStream printer={printerWithStatus} />
                          </Box>

                          {/* Footer */}
                          <Box sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: '8px',
                            background: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            zIndex: 2
                          }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2">
                                {printer.type === 'BAMBULAB' ? 'Nozzle' : 'Hotend'}: {getTemperature(printerWithStatus, 'nozzle')}°C
                              </Typography>
                              <Typography variant="body2">
                                Bed: {getTemperature(printerWithStatus, 'bed')}°C
                              </Typography>
                              <Typography variant="body2">
                                Chamber: {getTemperature(printerWithStatus, 'chamber')}°C
                              </Typography>
                              <Typography variant="body2" sx={{ color: getPrintStatus(printerWithStatus).color }}>
                                {getPrintStatus(printerWithStatus).text}
                              </Typography>
                            </Box>
                            {getPrintStatus(printerWithStatus).text === 'Printing' && (
                              <Box sx={{ mt: 1 }}>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={getPrintProgress(printerWithStatus)}
                                  sx={{
                                    height: 4,
                                    borderRadius: 2,
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    '& .MuiLinearProgress-bar': {
                                      backgroundColor: '#4caf50'
                                    }
                                  }}
                                />
                                <Typography variant="body2" sx={{ mt: 0.5, textAlign: 'center' }}>
                                  Remaining: {printerWithStatus.remaining_time || 0} min
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </Grid>
          )}
        </Droppable>
      </DragDropContext>

      <AddPrinterDialog 
        open={open}
        onClose={handleClose}
        onAdd={handleAddPrinter}
        isAdding={isAdding}
        isDarkMode={isDarkMode}
        scannedPrinters={scannedPrinters}
        isScanning={isScanning}
        scanTimer={scanTimer}
        onScan={handleScan}
      />

      {/* Styled Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          '& .MuiPaper-root': {
            borderRadius: '1.5rem',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 255, 255, 0.3)',
            boxShadow: '0 0 2rem rgba(0, 255, 255, 0.2)',
            minWidth: '300px'
          }
        }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{
            width: '100%',
            borderRadius: '1.5rem',
            background: snackbar.severity === 'success' 
              ? 'rgba(0, 180, 180, 0.95)'
              : 'rgba(180, 0, 0, 0.95)',
            color: '#ffffff',
            '& .MuiAlert-icon': {
              color: '#ffffff'
            },
            '& .MuiAlert-action': {
              color: '#ffffff'
            }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      <NotificationButton />
      <SystemStatsButton onClick={() => setStatsDialogOpen(true)} />
      <SystemStatsDialog 
        open={statsDialogOpen}
        onClose={() => setStatsDialogOpen(false)}
      />
    </div>
  );
};

export default PrinterGrid; 