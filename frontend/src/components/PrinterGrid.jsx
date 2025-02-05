import React, { useState, useEffect } from 'react';
import { Grid, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography, Box, List, ListItem, ListItemText, IconButton, CircularProgress, Chip, Divider, Collapse, Snackbar, Alert, LinearProgress, FormControlLabel, SpeedDial, SpeedDialIcon, SpeedDialAction } from '@mui/material';
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

// Dynamische API URL basierend auf dem aktuellen Host
const API_URL = `http://${window.location.hostname}:4000`;

console.log('Using API URL:', API_URL);  // Debug log

const PrinterGrid = ({ onThemeToggle, isDarkMode, mode, onModeChange, printers = [] }) => {
  // Stelle sicher, dass printers immer ein Array ist
  const printerList = Array.isArray(printers) ? printers : [];
  const [localPrinters, setLocalPrinters] = useState([]);

  // Bestimme welche Drucker angezeigt werden sollen
  const displayPrinters = mode === 'cloud' ? printerList : localPrinters;
  
  // Speichere Drucker bei Änderungen
  useEffect(() => {
    localStorage.setItem('printers', JSON.stringify(localPrinters));
  }, [localPrinters]);

  // Lade Drucker beim Start und alle 30 Sekunden neu
  useEffect(() => {
    let isMounted = true;

    const loadPrinters = async () => {
      try {
        console.log('Lade Drucker...');
        const response = await fetch(`${API_URL}/printers`);
        const data = await response.json();
        if (isMounted) {
          setLocalPrinters(data);
        }
      } catch (error) {
        console.error('Error loading printers:', error);
      }
    };

    loadPrinters();

    return () => {
      isMounted = false;
    };
  }, []);

  const [open, setOpen] = useState(false);
  const [newPrinter, setNewPrinter] = useState({ name: '', ip: '', accessCode: '' });
  const [isScanning, setIsScanning] = useState(false);
  const [scanTimer, setScanTimer] = useState(10);
  const [foundPrinters, setFoundPrinters] = useState([]);
  const [printerStatus, setPrinterStatus] = useState({});
  const [fullscreenPrinter, setFullscreenPrinter] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [scannedPrinters, setScannedPrinters] = useState([]);

  useEffect(() => {
    const fetchStatus = async () => {
      const newStatus = {};
      for (const printer of localPrinters) {
        try {
          const response = await fetch(`${API_URL}/printers/${printer.id}/status`);
          if (response.ok) {
            const data = await response.json();
            newStatus[printer.id] = data;
          }
        } catch (error) {
          console.error(`Fehler beim Abrufen des Status für Drucker ${printer.id}:`, error);
        }
      }
      setPrinterStatus(newStatus);
    };

    if (localPrinters.length > 0) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [localPrinters]);

  const handleAddPrinter = async (selectedPrinter) => {
    try {
      setIsAdding(true);
      console.log('Füge Drucker hinzu:', selectedPrinter);
      
      // Konstruiere Stream-URL
      const streamUrl = `rtsps://bblp:${selectedPrinter.accessCode}@${selectedPrinter.ip}:322/streaming/live/1`;
      
      const printerData = {
        ...selectedPrinter,
        type: 'BAMBULAB',
        streamUrl: streamUrl // Wichtig: Stream-URL mitgeben
      };
      
      const response = await fetch(`${API_URL}/printers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(printerData)
      });

      const data = await response.json();
      console.log('Server Response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      // Drucker wurde erfolgreich hinzugefügt
      if (data.success && data.printer) {
        setLocalPrinters(prev => [...prev, data.printer]);
        setOpen(false);
        setNewPrinter({ name: '', ip: '', accessCode: '' });
        
        setSnackbar({
          open: true,
          message: `Printer "${data.printer.name}" added successfully`,
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
      setSnackbar({
        open: true,
        message: `Error: ${error.message}`,
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

  const handleFullscreen = (printer) => {
    setFullscreenPrinter(printer);
  };

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
        setLocalPrinters(printers => printers.filter(p => p.id !== printerId));
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

  const onDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(localPrinters);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setLocalPrinters(items);
    localStorage.setItem('printers', JSON.stringify(items));
  };

  // Lade die gespeicherte Reihenfolge beim Start
  useEffect(() => {
    try {
      const savedPrinters = localStorage.getItem('printers');
      if (savedPrinters) {
        const parsedPrinters = JSON.parse(savedPrinters);
        // Stelle sicher, dass alle Drucker eine ID haben
        const validPrinters = parsedPrinters.filter(printer => printer.id);
        if (localPrinters.length === 0) {
          setLocalPrinters(validPrinters);
        }
      }
    } catch (error) {
      console.error('Error loading saved printers:', error);
    }
  }, [localPrinters.length]);

  const handleClose = () => {
    setOpen(false);
    setNewPrinter({ name: '', ip: '', accessCode: '' });
  };

  // Status-Anzeige Funktionen
  const getTemperature = (printer, type) => {
    try {
      const temps = printerStatus[printer.id]?.temperatures;
      if (!temps) return '-.--';
      
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
    } catch (e) {
      return '-.--';
    }
  };

  const getPrintStatus = (printer) => {
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
        console.log('Unhandled printer status:', status);  // Debug-Log für unbekannte Status
        return { text: status, color: '#9e9e9e' };  // Zeige den tatsächlichen Status
      default:
        return { text: 'Unknown', color: '#9e9e9e' };
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
          title={`Klicken um zu ${isDarkMode ? 'Light' : 'Dark'} Mode zu wechseln`}
        />

        {/* Cloud/LAN Switch in der Mitte */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',  // Zentriert den Switch-Container
          flex: 1  // Nimmt den verfügbaren Platz ein
        }}>
          <NeonSwitch
            checked={mode === 'cloud'}
            onChange={(e) => onModeChange(e.target.checked ? 'cloud' : 'lan')}
          />
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
        <Droppable droppableId="printers">
          {(provided) => (
            <Grid container spacing={3} {...provided.droppableProps} ref={provided.innerRef}>
              {Array.isArray(displayPrinters) && displayPrinters.map((printer, index) => {
                const dragId = printer.id ? printer.id.toString() : `printer-${index}`;
                
                return (
                  <Draggable
                    key={dragId}
                    draggableId={dragId}
                    index={index}
                  >
                    {(provided) => (
                      <Grid item xs={12} sm={12} md={6} lg={6}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          ...provided.draggableProps.style,
                          zIndex: 1
                        }}
                      >
                        <Paper 
                          sx={{ 
                            position: 'relative',
                            height: 0,
                            paddingBottom: 'calc(56.25% + 40px)',  // 16:9 (56.25%) + Header/Footer
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
                            <Typography variant="subtitle1">{printer.name}</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <IconButton size="small" sx={{ color: 'white' }} onClick={() => handleFullscreen(printer)}>
                                <FullscreenIcon />
                              </IconButton>
                              <IconButton size="small" sx={{ color: 'white' }} onClick={() => handleDelete(printer.id)}>
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
                            <RTSPStream printer={printer} />
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
                                Hotend: {getTemperature(printer, 'nozzle')}°C
                              </Typography>
                              <Typography variant="body2">
                                Bed: {getTemperature(printer, 'bed')}°C
                              </Typography>
                              <Typography variant="body2">
                                Chamber: {getTemperature(printer, 'chamber')}°C
                              </Typography>
                              <Typography variant="body2" sx={{ color: getPrintStatus(printer).color }}>
                                {getPrintStatus(printer).text}
                              </Typography>
                            </Box>
                            {getPrintStatus(printer).text === 'Printing' && (
                              <Box sx={{ mt: 1 }}>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={getPrintProgress(printer)}
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
                                  Remaining: {printerStatus[printer.id]?.remaining_time || 0} min
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

      <Dialog 
        open={open} 
        onClose={handleClose}
        PaperProps={{
          sx: {
            borderRadius: '20px',
            background: isDarkMode ? 'rgba(45, 45, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            maxWidth: '600px',
            width: '90%',
            boxShadow: isDarkMode 
              ? '0 8px 32px rgba(0, 0, 0, 0.3)'
              : '0 8px 32px rgba(0, 0, 0, 0.1)',
            '& .MuiDialogTitle-root': {
              borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              pb: 2,
              color: isDarkMode ? '#fff' : 'inherit'
            },
            '& .MuiDialogContent-root': {
              mt: 2,
              color: isDarkMode ? '#fff' : 'inherit'
            },
            '& .MuiTextField-root': {
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.23)' : 'rgba(0,0,0,0.23)'
                },
                '&:hover fieldset': {
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
                }
              },
              '& .MuiInputLabel-root': {
                color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit'
              },
              '& input': {
                color: isDarkMode ? '#fff' : 'inherit'
              }
            },
            '& .MuiButton-root': {
              color: isDarkMode ? '#fff' : 'inherit'
            },
            '& .MuiIconButton-root': {
              color: isDarkMode ? '#fff' : 'inherit'
            },
            '& .MuiListItem-root': {
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#e0e0e0'}`,
              '&:hover': {
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
              }
            },
            '& .MuiListItemText-primary': {
              color: isDarkMode ? '#fff' : 'inherit'
            },
            '& .MuiListItemText-secondary': {
              color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit'
            }
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          pb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Add New Printer</span>
          <IconButton
            onClick={() => setShowGuide(!showGuide)}
            title="Setup Guide"
          >
            <InfoIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {/* Only show guide when showGuide is true */}
          <Collapse in={showGuide}>
            <Box sx={{ mb: 3, mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                BambuLab Printer Setup:
              </Typography>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Connect the printer to your network via LAN cable</li>
                <li>Enable LAN Mode Liveview:
                  <ul>
                    <li>Go to "Settings" (gear icon) > "General"</li>
                    <li>Enable "LAN Mode Liveview"</li>
                    <li>Note down the Access Code</li>
                  </ul>
                </li>
                <li>Find the IP address under:
                  <ul>
                    <li>Settings > Network > IP Address</li>
                  </ul>
                </li>
                <li>Click "Scan Network" or enter the IP manually</li>
              </ol>
            </Box>
          </Collapse>
          
          {/* Scan Button */}
          <button 
            className="neon-scan-button"
            onClick={handleScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                Scanning... ({scanTimer}s)
              </>
            ) : (
              'Scan Network'
            )}
          </button>

          {/* Found Printers */}
          {scannedPrinters.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Found Printers:
              </Typography>
              <List>
                {scannedPrinters.map((printer) => (
                  <ListItem 
                    key={printer.id}
                    button
                    sx={{
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      mb: 1
                    }}
                    onClick={() => {
                      setNewPrinter({
                        name: printer.name,
                        ip: printer.ip,
                        accessCode: ''
                      });
                    }}
                  >
                    <ListItemText 
                      primary={printer.name}
                      secondary={`${printer.ip} (${printer.model})`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Manual Input */}
          <TextField
            autoFocus
            margin="dense"
            label="Printer Name"
            fullWidth
            value={newPrinter.name}
            onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="IP Address"
            fullWidth
            value={newPrinter.ip}
            onChange={(e) => setNewPrinter({ ...newPrinter, ip: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Access Code"
            fullWidth
            value={newPrinter.accessCode}
            onChange={(e) => setNewPrinter({ ...newPrinter, accessCode: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button 
            onClick={handleClose}
            disabled={isAdding}
            >Cancel</Button>
          <Button 
            onClick={() => handleAddPrinter(newPrinter)}
            disabled={isAdding || !newPrinter.name || !newPrinter.ip || !newPrinter.accessCode}
            variant="contained"
            >Add</Button>
        </DialogActions>
      </Dialog>

      <FullscreenDialog
        printer={fullscreenPrinter}
        open={fullscreenPrinter !== null}
        onClose={() => {
          // Stream stoppen beim Schließen
          if (fullscreenPrinter) {
            // Optional: Cleanup-Code hier
          }
          setFullscreenPrinter(null);
        }}
        getTemperature={getTemperature}
        printerStatus={printerStatus}
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
    </div>
  );
};

export default PrinterGrid; 