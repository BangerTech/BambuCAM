import React, { useState, useEffect } from 'react';
import { Grid, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography, Box, List, ListItem, ListItemText, IconButton, CircularProgress, Chip, Divider, Collapse, Snackbar, Alert } from '@mui/material';
import RTSPStream from './RTSPStream';
import DeleteIcon from '@mui/icons-material/Delete';
import '../styles/NeonButton.css';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';

// Dynamische API URL basierend auf dem aktuellen Host
const API_URL = `http://${window.location.hostname}:4000`;

console.log('Using API URL:', API_URL);  // Debug log

const PrinterGrid = ({ onThemeToggle, isDarkMode }) => {
  const [printers, setPrinters] = useState(() => {
    // Versuche gespeicherte Drucker beim Start zu laden
    const savedPrinters = localStorage.getItem('printers');
    return savedPrinters ? JSON.parse(savedPrinters) : [];
  });

  // Speichere Drucker bei Änderungen
  useEffect(() => {
    localStorage.setItem('printers', JSON.stringify(printers));
  }, [printers]);

  // Lade Drucker beim Start und alle 30 Sekunden neu
  useEffect(() => {
    const loadPrinters = async () => {
      try {
        console.log('Lade Drucker...');
        const response = await fetch(`${API_URL}/printers`);
        if (!response.ok) throw new Error('Netzwerk-Antwort war nicht ok');
        const data = await response.json();
        setPrinters(data);
      } catch (error) {
        console.error('Fehler beim Laden der Drucker:', error);
      }
    };

    loadPrinters();
    const interval = setInterval(loadPrinters, 30000);

    return () => clearInterval(interval);
  }, []);

  const [open, setOpen] = useState(false);
  const [newPrinter, setNewPrinter] = useState({ name: '', ip: '', accessCode: '' });
  const [isScanning, setIsScanning] = useState(false);
  const [foundPrinters, setFoundPrinters] = useState([]);
  const [printerStatus, setPrinterStatus] = useState({});
  const [fullscreenPrinter, setFullscreenPrinter] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' // oder 'error'
  });

  useEffect(() => {
    const fetchStatus = async () => {
      const newStatus = {};
      for (const printer of printers) {
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

    if (printers.length > 0) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [printers]);

  const handleAddPrinter = async (selectedPrinter) => {
    try {
      setIsAdding(true);  // Start Loading
      console.log('Füge Drucker hinzu:', selectedPrinter);
      
      // Generiere die Stream-URL basierend auf dem Drucker-Typ
      const streamUrl = selectedPrinter.streamUrl || (
        selectedPrinter.ip.includes('mock-printer')
          ? `rtsp://bblp:${selectedPrinter.accessCode}@${selectedPrinter.ip}:8554/streaming/live/1`
          : `rtsps://bblp:${selectedPrinter.accessCode}@${selectedPrinter.ip}:322/streaming/live/1`
      );

      console.log('Stream URL:', streamUrl);

      const printerData = {
        name: selectedPrinter.name,
        ipAddress: selectedPrinter.ip,
        accessCode: selectedPrinter.accessCode,
        streamUrl: streamUrl,
        isMockPrinter: selectedPrinter.ip.includes('mock-printer')
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

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Unknown error');
      }

      if (data.success && data.printer) {
        setPrinters(prev => [...prev, data.printer]);
        setFoundPrinters(prev => prev.filter(p => p.ip !== selectedPrinter.ip));
        setOpen(false);
        setNewPrinter({ name: '', ip: '', accessCode: '' });
        
        // Erfolgs-Snackbar anzeigen
        setSnackbar({
          open: true,
          message: `Drucker "${data.printer.name}" wurde erfolgreich hinzugefügt`,
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
      // Error-Snackbar anzeigen
      setSnackbar({
        open: true,
        message: `Fehler: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsAdding(false);  // Ende Loading
    }
  };

  const handleScan = async () => {
    try {
      console.log('Starte Scan...');
      setIsScanning(true);
      const response = await fetch(`${API_URL}/scan`);
      console.log('Scan Response:', response);
      
      if (!response.ok) {
        throw new Error(`Scan failed with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Gefundene Drucker:', data);
      
      if (Array.isArray(data)) {
        setFoundPrinters(data);
      } else if (data.mockPrinters) {
        // Fallback zu Mock-Printern wenn der Scan fehlschlägt
        setFoundPrinters(data.mockPrinters);
        setSnackbar({
          open: true,
          message: 'Scan fehlgeschlagen, zeige Mock-Drucker',
          severity: 'warning'
        });
      }
    } catch (error) {
      console.error('Fehler beim Scannen:', error);
      setSnackbar({
        open: true,
        message: `Scan-Fehler: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleFullscreen = (printer) => {
    setFullscreenPrinter(printer);
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`${API_URL}/printers/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setPrinters(prev => prev.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(printers);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setPrinters(items);
  };

  const handleClose = () => {
    setOpen(false);
    setNewPrinter({ name: '', ip: '', accessCode: '' });
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
            transform: 'scale(1)',
            '&:hover': {
              transform: 'scale(1.05)'
            }
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onClick={onThemeToggle}
          title={`Klicken um zu ${isDarkMode ? 'Light' : 'Dark'} Mode zu wechseln`}
        />
        
        {/* Neon Button */}
        <button 
          className="neon-pulse-button"
          onClick={() => setOpen(true)}
        >
          +<span>Drucker hinzufügen</span>
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="printers" direction="horizontal">
          {(provided) => (
            <Grid container spacing={3} {...provided.droppableProps} ref={provided.innerRef}>
              {printers.map((printer, index) => (
                <Draggable key={printer.id} draggableId={printer.id.toString()} index={index}>
                  {(provided) => (
                    <Grid item xs={12} md={6} xl={4} 
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <Paper 
                        sx={{ 
                          position: 'relative',
                          height: 0,
                          paddingBottom: 'calc(56.25% + 80px)', // Reduziert von 120px auf 80px
                          borderRadius: '15px',
                          overflow: 'hidden',
                          background: '#000',
                          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                          minHeight: '300px',
                          '@media (min-width: 1200px)': {
                            minHeight: '400px'
                          }
                        }}
                      >
                        {/* Header-Bereich */}
                        <Box sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '40px', // Reduziert von 60px auf 40px
                          padding: '8px', // Reduziert von 10px auf 8px
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

                        {/* Video-Stream im mittleren Bereich */}
                        <Box sx={{
                          position: 'absolute',
                          top: '40px', // Angepasst
                          left: 0,
                          right: 0,
                          bottom: '40px', // Angepasst
                          background: '#000'
                        }}>
                          <RTSPStream 
                            url={printer.streamUrl} 
                            wsPort={printer.wsPort}
                          />
                        </Box>

                        {/* Footer-Bereich */}
                        <Box sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: '40px', // Reduziert von 60px auf 40px
                          padding: '8px', // Reduziert von 10px auf 8px
                          background: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          zIndex: 2
                        }}>
                          <Typography variant="body2">
                            Hotend: {printerStatus[printer.id]?.temperatures.nozzle.toFixed(1)}°C
                          </Typography>
                          <Typography variant="body2">
                            Bed: {printerStatus[printer.id]?.temperatures.bed.toFixed(1)}°C
                          </Typography>
                          {printerStatus[printer.id]?.printTime.remaining > 0 && (
                            <Typography variant="body2">
                              {Math.floor(printerStatus[printer.id].printTime.remaining / 60)}min
                            </Typography>
                          )}
                        </Box>
                      </Paper>
                    </Grid>
                  )}
                </Draggable>
              ))}
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
          <span>Neuen Drucker hinzufügen</span>
          <IconButton
            onClick={() => setShowGuide(!showGuide)}
            title="Einrichtungsanleitung"
          >
            <InfoIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {/* Anleitung nur anzeigen wenn showGuide true ist */}
          <Collapse in={showGuide}>
            <Box sx={{ mb: 3, mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Einrichtung eines BambuLab Druckers:
              </Typography>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Verbinden Sie den Drucker mit Ihrem Netzwerk per LAN-Kabel</li>
                <li>Aktivieren Sie den LAN Mode Liveview:
                  <ul>
                    <li>Gehen Sie zu "Einstellungen" (Zahnrad) > "Allgemein"</li>
                    <li>Aktivieren Sie "LAN Mode Liveview"</li>
                    <li>Notieren Sie sich den Access Code</li>
                  </ul>
                </li>
                <li>Die IP-Adresse finden Sie unter:
                  <ul>
                    <li>Einstellungen > Netzwerk > IP-Adresse</li>
                  </ul>
                </li>
                <li>Klicken Sie auf "Nach Druckern suchen" oder geben Sie die IP manuell ein</li>
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
                Scanne...
              </>
            ) : (
              'Nach Druckern suchen'
            )}
          </button>

          {/* Gefundene Drucker */}
          {foundPrinters.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Gefundene Drucker:
              </Typography>
              <List>
                {foundPrinters.map((printer) => (
                  <ListItem 
                    key={printer.ip}
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
                        accessCode: printer.isMockPrinter ? '12345678' : ''
                      });
                    }}
                  >
                    <ListItemText 
                      primary={printer.name}
                      secondary={`${printer.ip} (${printer.model})`}
                    />
                    {printer.isMockPrinter && (
                      <Chip 
                        label="Mock Printer"
                        size="small"
                        color="secondary"
                      />
                    )}
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Manuelle Eingabe */}
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={newPrinter.name}
            onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="IP-Adresse"
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
            sx={{ 
              color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
              borderRadius: '1.5rem',
              textTransform: 'none',
              padding: '8px 24px',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`,
              '&:hover': {
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}`,
                background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
              }
            }}
          >
            Abbrechen
          </Button>
          <Button 
            onClick={(e) => handleAddPrinter(newPrinter)}
            disabled={!newPrinter.name || !newPrinter.ip || isAdding}
            sx={{ 
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#ffffff',
              borderRadius: '1.5rem',
              textTransform: 'none',
              padding: '8px 24px',
              border: '0.15rem solid #00ffff',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 0 2rem rgba(0, 255, 255, 0.3)',
              '&:hover': {
                boxShadow: '0 0 5rem rgba(0, 255, 255, 0.6)',
                background: 'rgba(0, 0, 0, 0.85)',
                color: '#ffffff'
              },
              '&:disabled': {
                opacity: 0.6,
                color: 'rgba(255,255,255,0.7)'
              }
            }}
          >
            {isAdding ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                Füge hinzu...
              </>
            ) : (
              'Hinzufügen'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fullscreen Dialog mit Abstand */}
      <Dialog 
        fullScreen 
        open={fullscreenPrinter !== null} 
        onClose={() => setFullscreenPrinter(null)}
        PaperProps={{
          sx: {
            margin: '20px',
            borderRadius: '15px',
            overflow: 'hidden',
            background: '#000'
          }
        }}
      >
        <IconButton
          onClick={() => setFullscreenPrinter(null)}
          sx={{
            position: 'absolute',
            right: 16,
            top: 16,
            color: 'white',
            zIndex: 3,
            background: 'rgba(0,0,0,0.5)',
            '&:hover': {
              background: 'rgba(0,0,0,0.7)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
        {fullscreenPrinter && (
          <Box sx={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <RTSPStream 
                url={fullscreenPrinter.streamUrl} 
                wsPort={fullscreenPrinter.wsPort}
              />
            </Box>
            
            {/* Status-Overlay */}
            <Box sx={{
              padding: '20px',
              background: 'rgba(0,0,0,0.7)',
              color: 'white'
            }}>
              <Typography variant="h6">{fullscreenPrinter.name}</Typography>
              <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                <Typography>
                  Hotend: {printerStatus[fullscreenPrinter.id]?.temperatures.nozzle.toFixed(1)}°C
                </Typography>
                <Typography>
                  Bed: {printerStatus[fullscreenPrinter.id]?.temperatures.bed.toFixed(1)}°C
                </Typography>
                {printerStatus[fullscreenPrinter.id]?.printTime.remaining > 0 && (
                  <Typography>
                    Verbleibend: {Math.floor(printerStatus[fullscreenPrinter.id].printTime.remaining / 60)}min
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Dialog>

      {/* Stylische Snackbar */}
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