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
import Header from './Header';
import CloudPrinterCard from './CloudPrinterCard';
import CloudPrinterDialog from './CloudPrinterDialog';

console.log('Using API URL:', API_URL);  // Debug log

const PrinterGrid = ({ onThemeToggle, isDarkMode, mode, onModeChange, printers = [], isMobile }) => {
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
  const [cloudPrinterDialogOpen, setCloudPrinterDialogOpen] = useState(false);
  const [availableCloudPrinters, setAvailableCloudPrinters] = useState([]);

  // Stelle sicher, dass printers immer ein Array ist
  const printerList = Array.isArray(printers) ? printers : [];
  const [localPrinters, setLocalPrinters] = useState([]);
  const [cloudPrinters, setCloudPrinters] = useState([]);
  const [printerOrder, setPrinterOrder] = useState(() => {
    const savedOrder = localStorage.getItem('printerOrder');
    console.log('Loading printer order from localStorage:', savedOrder);
    
    try {
      if (!savedOrder) return [];
      
      const parsed = JSON.parse(savedOrder);
      
      // Handle both array and object formats for backward compatibility
      if (Array.isArray(parsed)) {
        console.log('Loaded printer order (array format):', parsed);
        return parsed;
      } else if (typeof parsed === 'object') {
        // Convert object format {id: position} to array of ids sorted by position
        const entries = Object.entries(parsed);
        entries.sort((a, b) => a[1] - b[1]); // Sort by position value
        const result = entries.map(entry => entry[0]); // Return array of ids
        console.log('Loaded printer order (converted from object):', result);
        return result;
      }
      return [];
    } catch (e) {
      console.warn('Error parsing printerOrder from localStorage:', e);
      return [];
    }
  });
  
  // Bestimme welche Drucker angezeigt werden sollen
  const displayPrinters = mode === 'cloud' ? cloudPrinters : localPrinters;
  
  // Sortiere Drucker nach gespeicherter Reihenfolge
  const sortedPrinters = [...displayPrinters].sort((a, b) => {
    const indexA = printerOrder.indexOf(a.id);
    const indexB = printerOrder.indexOf(b.id);
    if (indexA === -1) return 1;  // Neue Drucker ans Ende
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  
  // Debug log for sorted printers
  useEffect(() => {
    console.log('Sorted printers:', {
      printerOrder,
      displayPrinters: displayPrinters.map(p => ({ id: p.id, name: p.name })),
      sortedPrinters: sortedPrinters.map(p => ({ id: p.id, name: p.name }))
    });
  }, [printerOrder, displayPrinters, sortedPrinters]);

  // Aktualisiere die Reihenfolge wenn sich die Drucker ändern
  useEffect(() => {
    // Skip this effect if displayPrinters is empty (during initial load)
    if (displayPrinters.length === 0) {
      console.log('Skipping printer order update because displayPrinters is empty');
      return;
    }
    
    // Skip this effect if we're just reordering the same printers
    if (displayPrinters.length === printerOrder.length && 
        displayPrinters.every(printer => printerOrder.includes(printer.id))) {
      return;
    }
    
    // Entferne gelöschte Drucker aus der Reihenfolge
    const validOrder = printerOrder.filter(id => 
      displayPrinters.some(printer => printer.id === id)
    );
    
    // Füge neue Drucker hinzu
    const newOrder = [...validOrder];
    displayPrinters.forEach(printer => {
      if (!newOrder.includes(printer.id)) {
        newOrder.push(printer.id);
      }
    });
    
    console.log('Updating printer order based on available printers:', {
      previous: printerOrder,
      new: newOrder,
      displayPrinters: displayPrinters.map(p => ({ id: p.id, name: p.name }))
    });
    
    setPrinterOrder(newOrder);
  }, [displayPrinters]);

  // Speichere Drucker-Reihenfolge bei Änderungen
  useEffect(() => {
    localStorage.setItem('printerOrder', JSON.stringify(printerOrder));
    console.log('Saved printer order:', printerOrder);
  }, [printerOrder]);

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
        // Filter printers based on type
        const lanPrinters = data.filter(printer => !printer.isCloud && printer.type !== 'CLOUD');
        setLocalPrinters(lanPrinters);
        setError(null);
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
    let isMounted = true;
    const fetchCloudPrinters = async () => {
      try {
        // Hole nur die bereits hinzugefügten Cloud-Drucker
        const response = await fetch(`${API_URL}/printers`);
        const data = await response.json();
        if (isMounted && Array.isArray(data)) {
          // Filtere nur die Cloud-Drucker
          const cloudPrinters = data.filter(printer => printer.type === 'CLOUD' || printer.isCloud);
          console.log('Loaded cloud printers from system:', cloudPrinters);
          setCloudPrinters(cloudPrinters);
        }
      } catch (error) {
        console.error('Error fetching cloud printers:', error);
      }
    };

    if (mode === 'cloud') {
      fetchCloudPrinters();
      // Set up polling interval for cloud printers
      const interval = setInterval(fetchCloudPrinters, 5000);
      return () => clearInterval(interval);
    } else {
      // Clear cloud printers when switching to LAN mode
      setCloudPrinters([]);
    }
  }, [mode]); // Run when mode changes

  const [scanTimer, setScanTimer] = useState(10);
  const [foundPrinters, setFoundPrinters] = useState([]);
  const [printerStatus, setPrinterStatus] = useState({});

  // Status-Polling für LAN Drucker
  useEffect(() => {
    const updateLANPrinterStatus = async () => {
      // Nur ausführen wenn wir im LAN Modus sind
      if (mode !== 'lan') return;

      for (const printer of localPrinters) {
        try {
          const data = await printerApi.fetchStatus(printer.id);
          setPrinterStatus(prev => ({
            ...prev,
            [printer.id]: data
          }));
        } catch (error) {
          Logger.error('Error updating LAN printer status:', error);
        }
      }
    };

    if (localPrinters.length > 0 && mode === 'lan') {
      updateLANPrinterStatus();
      const interval = setInterval(updateLANPrinterStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [localPrinters, mode]);

  // Status-Polling für OctoPrint Drucker
  useEffect(() => {
    const updateOctoPrintStatus = async () => {
      // Nur ausführen wenn wir im LAN Modus sind
      if (mode !== 'lan') return;

      // Filtere nur OctoPrint Drucker
      const octoPrinters = localPrinters.filter(printer => printer.type === 'OCTOPRINT');
      
      for (const printer of octoPrinters) {
        try {
          const response = await fetch(`${API_URL}/printers/${printer.id}/status`);
          if (!response.ok) continue;
          
          const data = await response.json();
          Logger.info('OctoPrint status update:', data);
          
          // Get current printer status to preserve temperature data if needed
          const currentStatus = printerStatus[printer.id] || {};
          const currentTemps = currentStatus.temperatures || {};
          
          // Only update temperatures if they are non-zero in the new data
          const newTemps = data.temps || data.temperatures || {};
          const mergedTemps = {
            hotend: newTemps.hotend > 0 ? newTemps.hotend : (currentTemps.hotend || 0),
            nozzle: newTemps.nozzle > 0 ? newTemps.nozzle : (currentTemps.nozzle || 0),
            bed: newTemps.bed > 0 ? newTemps.bed : (currentTemps.bed || 0),
            chamber: newTemps.chamber > 0 ? newTemps.chamber : (currentTemps.chamber || 0)
          };
          
          setPrinterStatus(prev => ({
            ...prev,
            [printer.id]: {
              ...data,
              temperatures: mergedTemps
            }
          }));
        } catch (error) {
          Logger.error('Error updating OctoPrint printer status:', error);
        }
      }
    };

    if (localPrinters.length > 0 && mode === 'lan') {
      updateOctoPrintStatus();
      const interval = setInterval(updateOctoPrintStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [localPrinters, mode]);

  // Status-Polling für Cloud Drucker
  useEffect(() => {
    const updateCloudPrinterStatus = async () => {
      // Nur ausführen wenn wir im Cloud Modus sind
      if (mode !== 'cloud') return;

      for (const printer of cloudPrinters) {
        try {
          const response = await fetch(`${API_URL}/cloud/printers/${printer.id}/status`, {
            credentials: 'include'
          });
          if (!response.ok) continue;
          
          const data = await response.json();
          setPrinterStatus(prev => ({
            ...prev,
            [printer.id]: data
          }));
        } catch (error) {
          Logger.error('Error updating cloud printer status:', error);
        }
      }
    };

    if (cloudPrinters.length > 0 && mode === 'cloud') {
      updateCloudPrinterStatus();
      const interval = setInterval(updateCloudPrinterStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [cloudPrinters, mode]);

  // Kombiniere Drucker mit ihrem Status basierend auf dem Modus
  const printersWithStatus = mode === 'cloud' ? 
    cloudPrinters.map(printer => ({
      ...printer,
      ...printerStatus[printer.id]
    })) :
    localPrinters.map(printer => ({
      ...printer,
      ...printerStatus[printer.id]
    }));

  // Beim Moduswechsel Status zurücksetzen
  useEffect(() => {
    setPrinterStatus({}); // Status beim Moduswechsel zurücksetzen
  }, [mode]);

  // Funktion zum Aktualisieren der Positionen
  const updatePrinterOrder = (printers) => {
    const newOrder = printers.map(printer => printer.id);
    setPrinterOrder(newOrder);
    console.log('Updated printer order:', newOrder);
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
      const printer = [...localPrinters, ...cloudPrinters].find(p => p.id === printerId);
      if (!printer) {
        throw new Error('Printer not found');
      }

      const isCloudPrinter = printer.type === 'CLOUD' || printer.isCloud;
      const endpoint = isCloudPrinter 
        ? `${API_URL}/cloud/printer/${printerId}`
        : `${API_URL}/printers/${printerId}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete printer');
      }

      // Aktualisiere die Listen
      if (isCloudPrinter) {
        setCloudPrinters(prev => prev.filter(p => p.id !== printerId));
      } else {
        setLocalPrinters(prev => prev.filter(p => p.id !== printerId));
      }

      // Zeige Erfolgsmeldung
      setSnackbar({
        open: true,
        message: 'Printer deleted successfully',
        severity: 'success'
      });

    } catch (error) {
      console.error('Error deleting printer:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete printer',
        severity: 'error'
      });
    }
  };

  // Aktualisierte onDragEnd Funktion
  const onDragEnd = (result) => {
    if (!result.destination) return;
    
    console.log('Drag end result:', {
      source: result.source,
      destination: result.destination,
      draggableId: result.draggableId
    });
    
    const items = Array.from(sortedPrinters);  // Benutze sortedPrinters statt localPrinters
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    console.log('Reordered items:', items.map(p => ({ id: p.id, name: p.name })));
    
    // Aktualisiere die Reihenfolge mit der updatePrinterOrder Funktion
    updatePrinterOrder(items);
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
      } else if (printer.type === 'OCTOPRINT') {
        switch(type) {
          case 'nozzle':
            return temps.hotend?.toFixed(1) || temps.nozzle?.toFixed(1) || '-.--';  // OctoPrint kann beide Namen verwenden
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
    } else if (printer.type === 'OCTOPRINT') {
      const status = printerStatus[printer.id]?.status?.toLowerCase() || 'unknown';
      
      switch(status) {
        case 'ready':
          return { text: 'Ready', color: '#2196f3' };
        case 'printing':
          return { text: 'Printing', color: '#4caf50' };
        case 'paused':
          return { text: 'Paused', color: '#ff9800' };
        case 'completed':
          return { text: 'Finished', color: '#4caf50' };
        case 'failed':
          return { text: 'Failed', color: '#f44336' };
        case 'error':
          return { text: 'Error', color: '#f44336' };
        case 'offline':
          return { text: 'Offline', color: '#9e9e9e' };
        case 'connecting':
          return { text: 'Connecting...', color: '#9e9e9e' };
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
    gridTemplateColumns: {
      xs: '1fr',                    // Mobile: 1 Karte pro Zeile
      sm: 'repeat(2, 1fr)',        // Tablet/Desktop: 2 Karten pro Zeile
    },
    gap: '20px',
    padding: '20px',
    '& .MuiPaper-root': {          // Für die PrinterCard
      width: '100%',               // Volle Breite im Grid
      aspectRatio: '16/9',         // Festes Seitenverhältnis
      minWidth: '280px',           // Minimale Breite
      maxWidth: '800px',           // Maximale Breite
      margin: '0 auto',            // Zentrieren wenn kleiner als Container
      height: 'auto'               // Höhe durch aspectRatio bestimmt
    }
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

  const handleAddPrinterClick = async () => {
    if (mode === 'cloud') {
      try {
        // Fetch available cloud printers
        const response = await fetch(`${API_URL}/cloud/printers`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch cloud printers');
        }
        const printers = await response.json();
        setAvailableCloudPrinters(printers);
        setCloudPrinterDialogOpen(true);
      } catch (error) {
        console.error('Error fetching cloud printers:', error);
        setSnackbar({
          open: true,
          message: 'Failed to fetch cloud printers',
          severity: 'error'
        });
      }
    } else {
      setOpen(true);
    }
  };

  if (fullscreenPrinter) {
    const printerWithStatus = getPrinterWithStatus(fullscreenPrinter);
    return (
      <div style={{ 
        position: 'fixed',
        top: '24px',
        left: '24px',
        right: '24px',
        bottom: '24px',
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <PrinterCard 
          printer={printerWithStatus}
          onDelete={handleDelete}
          isFullscreen={true}
          onFullscreenToggle={handleFullscreenToggle}
        />
      </div>
    );
  }

  return (
    <Box 
      sx={{ 
        padding: '20px',
        paddingTop: isMobile ? 'calc(env(safe-area-inset-top) + 70px)' : '90px'
      }}
    >
      <Header 
        onThemeToggle={onThemeToggle}
        isDarkMode={isDarkMode}
        mode={mode}
        onModeChange={onModeChange}
        onAddPrinter={handleAddPrinterClick}
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="printers">
          {(provided) => (
            <Box
              {...provided.droppableProps}
              ref={provided.innerRef}
              sx={gridStyle}
            >
              {sortedPrinters.map((printer, index) => (
                <Draggable
                  key={printer.id}
                  draggableId={printer.id}
                  index={index}
                  isDragDisabled={false}
                >
                  {(provided) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      {printer.isCloud ? (
                        <CloudPrinterCard
                          printer={getPrinterWithStatus(printer)}
                          onDelete={handleDelete}
                          isFullscreen={false}
                          onFullscreenToggle={() => handleFullscreenToggle(printer)}
                        />
                      ) : (
                        <PrinterCard
                          printer={getPrinterWithStatus(printer)}
                          onDelete={handleDelete}
                          isFullscreen={false}
                          onFullscreenToggle={() => handleFullscreenToggle(printer)}
                        />
                      )}
                    </Box>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Box>
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

      <CloudPrinterDialog
        open={cloudPrinterDialogOpen}
        onClose={(added) => {
          setCloudPrinterDialogOpen(false);
          if (added) {
            setSnackbar({
              open: true,
              message: 'Cloud printer added successfully',
              severity: 'success'
            });
          }
        }}
        printers={availableCloudPrinters}
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
    </Box>
  );
};

export default PrinterGrid; 