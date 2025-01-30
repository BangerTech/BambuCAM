import React, { useEffect, useState } from 'react';
import { Box, Grid, Typography, Paper, TextField, Button, Dialog, 
         DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import styled from '@emotion/styled';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const CameraView = styled(Paper)`
  aspect-ratio: 16/9;
  overflow: hidden;
  border-radius: 15px;
  background: #000;
  transition: transform 0.3s ease;
  position: relative;
  cursor: pointer;
  
  &:hover {
    transform: scale(1.02);
  }
`;

const CameraOverlay = styled(Box)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1;
`;

const ControlsOverlay = styled(Box)`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1;
`;

const FullscreenDialog = styled(Dialog)`
  .MuiDialog-paper {
    margin: 0;
    max-width: none;
    width: 100%;
    height: 100%;
    max-height: none;
    background: black;
  }
`;

const CameraCanvas = styled.canvas`
  width: 100%;
  height: 100%;
`;

const PageBackground = styled(Box)`
  position: relative;
  min-height: 100vh;
  background-color: #f5f5f7;
`;

const BackgroundImage = styled(Box)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('${process.env.PUBLIC_URL}/background.png') center center fixed;
  background-size: contain;
  background-repeat: no-repeat;
  opacity: 0.05;  // 5% Deckkraft
  z-index: 0;
`;

const ContentWrapper = styled(Box)`
  position: relative;
  z-index: 1;
  padding: 24px;
`;

function App() {
  const [printers, setPrinters] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [newPrinter, setNewPrinter] = useState({ 
    name: '', 
    ip: '',
    accessCode: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [streams, setStreams] = useState(new Map());
  const [fullscreenPrinter, setFullscreenPrinter] = useState(null);
  const [printerOrder, setPrinterOrder] = useState([]);

  const API_URL = `http://${window.location.hostname}:4000`;

  useEffect(() => {
    const loadPrinters = async () => {
      try {
        const response = await fetch(`${API_URL}/printers`);
        const data = await response.json();
        setPrinters(data);
        
        // Verbinde mit allen Druckern
        data.forEach(printer => {
          if (printer.wsPort) {
            connectToPrinter(printer);
          }
        });
      } catch (error) {
        console.error('Fehler beim Laden der Drucker:', error);
      }
    };

    loadPrinters();

    // Cleanup beim Unmount
    return () => {
      streams.forEach(stream => stream.destroy());
    };
  }, []);

  const connectToPrinter = (printer) => {
    console.log(`Verbinde mit WebSocket: ws://${window.location.hostname}:${printer.wsPort}`);
    
    try {
      const canvas = document.getElementById(`canvas-${printer.id}`);
      if (!canvas) {
        console.error(`Canvas für Drucker ${printer.name} nicht gefunden`);
        return;
      }

      // Warten bis JSMpeg verfügbar ist
      if (typeof JSMpeg === 'undefined') {
        console.error('JSMpeg ist nicht geladen');
        return;
      }

      // Erstellen Sie den WebSocket und Player
      const wsUrl = `ws://${window.location.hostname}:${printer.wsPort}`;
      const player = new JSMpeg.Player(wsUrl, {
        canvas: canvas,
        audio: false,
        pauseWhenHidden: false
      });

      // Speichern Sie den Player für spätere Referenz
      setStreams(prev => new Map(prev.set(printer.id, player)));

    } catch (error) {
      console.error(`Fehler beim Verbinden mit Drucker ${printer.name}:`, error);
    }
  };

  const handleAddPrinter = async () => {
    try {
      setIsLoading(true);

      // Prüfe ob es ein Mock-Printer ist
      const isMockPrinter = newPrinter.ip.startsWith('mock-printer');
      
      // Baue die korrekte URL basierend auf Printer-Typ
      const streamUrl = isMockPrinter
        ? `rtsp://bblp:12345678@${newPrinter.ip}:8554/streaming/live/1`
        : `rtsps://bblp:${newPrinter.accessCode}@${newPrinter.ip}:322/streaming/live/1`;

      const response = await fetch(`${API_URL}/printers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPrinter.name,
          ipAddress: newPrinter.ip,
          accessCode: newPrinter.accessCode,
          streamUrl: streamUrl,
          wsPort: 9100 + printers.length
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.details || 'Unbekannter Fehler');
      }

      setPrinters(prev => [...prev, data.printer]);
      connectToPrinter(data.printer);
      setOpenDialog(false);
      setNewPrinter({ name: '', ip: '', accessCode: '' });
    } catch (error) {
      alert(`Fehler: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePrinter = async (id) => {
    try {
      const response = await fetch(`${API_URL}/printers/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        if (streams.has(id)) {
          streams.get(id).destroy();
          setStreams(prev => {
            const newStreams = new Map(prev);
            newStreams.delete(id);
            return newStreams;
          });
        }
        
        setPrinters(prev => prev.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Druckers:', error);
      alert('Fehler beim Löschen des Druckers');
    }
  };

  // Fullscreen Handler
  const handleFullscreen = (printer, event) => {
    event.stopPropagation();
    setFullscreenPrinter(printer);
    
    // Warte kurz bis der neue Canvas gerendert ist
    setTimeout(() => {
      const canvas = document.getElementById(`canvas-${printer.id}-fullscreen`);
      if (canvas) {
        const wsUrl = `ws://${window.location.hostname}:${printer.wsPort}`;
        const player = new JSMpeg.Player(wsUrl, {
          canvas: canvas,
          audio: false,
          pauseWhenHidden: false
        });

        // Speichere den Fullscreen-Player
        setStreams(prev => new Map(prev.set(`${printer.id}-fullscreen`, player)));
      }
    }, 100);
  };

  // Cleanup beim Schließen des Fullscreen
  const handleCloseFullscreen = () => {
    if (fullscreenPrinter) {
      const fullscreenPlayer = streams.get(`${fullscreenPrinter.id}-fullscreen`);
      // Erst den Printer auf null setzen, dann den Player zerstören
      setFullscreenPrinter(null);
      
      // Kurze Verzögerung vor dem Zerstören des Players
      setTimeout(() => {
        if (fullscreenPlayer) {
          try {
            fullscreenPlayer.destroy();
            setStreams(prev => {
              const newStreams = new Map(prev);
              newStreams.delete(`${fullscreenPrinter.id}-fullscreen`);
              return newStreams;
            });
          } catch (error) {
            console.error('Fehler beim Beenden des Fullscreen-Players:', error);
          }
        }
      }, 100);
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
      
      <canvas 
        id={`canvas-${printer.id}${isFullscreen ? '-fullscreen' : ''}`} 
        style={{ 
          width: '100%', 
          height: '100%',
          backgroundColor: '#000'
        }}
      />
      
      {!isFullscreen && (
        <ControlsOverlay>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();  // Verhindert das Öffnen des Fullscreens
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

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(printers);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setPrinters(items);
  };

  return (
    <PageBackground>
      <BackgroundImage />
      <ContentWrapper>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 4,
          flexWrap: { xs: 'wrap', sm: 'nowrap' }  // Wrap auf kleinen Geräten
        }}>
          <Box sx={{ 
            height: { xs: 30, sm: 40 },  // Kleinere Höhe auf mobilen Geräten
            mb: { xs: 2, sm: 0 }  // Margin unten nur auf mobilen Geräten
          }}>
            <img 
              src={`${process.env.PUBLIC_URL}/logo.png`} 
              alt="BambuLab Cameras" 
              style={{ height: '100%', width: 'auto' }} 
            />
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={{ 
              bgcolor: '#007AFF',
              '&:hover': { bgcolor: '#0056b3' },
              fontSize: { xs: '0.875rem', sm: '1rem' },  // Kleinere Schrift auf mobilen Geräten
              py: { xs: 1, sm: 1.5 },  // Weniger Padding auf mobilen Geräten
              px: { xs: 2, sm: 3 }     // Weniger Padding auf mobilen Geräten
            }}
          >
            Drucker hinzufügen
          </Button>
        </Box>
        
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="printers">
            {(provided) => (
              <Grid 
                container 
                spacing={3}
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {printers.map((printer, index) => (
                  <Draggable 
                    key={printer.id} 
                    draggableId={printer.id.toString()} 
                    index={index}
                  >
                    {(provided) => (
                      <Grid 
                        item 
                        xs={12} 
                        md={6}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        {renderCameraView(printer)}
                      </Grid>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Grid>
            )}
          </Droppable>
        </DragDropContext>

        {/* Fullscreen Dialog */}
        <FullscreenDialog
          open={!!fullscreenPrinter}
          onClose={handleCloseFullscreen}
          fullScreen
        >
          <Box sx={{ height: '100%', position: 'relative' }}>
            {fullscreenPrinter && renderCameraView(fullscreenPrinter, true)}
          </Box>
        </FullscreenDialog>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
          <DialogTitle>Neuen Drucker hinzufügen</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Drucker Name"
              fullWidth
              value={newPrinter.name}
              onChange={(e) => setNewPrinter(prev => ({ ...prev, name: e.target.value }))}
            />
            <TextField
              margin="dense"
              label="IP-Adresse"
              fullWidth
              value={newPrinter.ip}
              onChange={(e) => setNewPrinter(prev => ({ ...prev, ip: e.target.value }))}
            />
            <TextField
              margin="dense"
              label="Access Code"
              fullWidth
              value={newPrinter.accessCode}
              onChange={(e) => setNewPrinter(prev => ({ ...prev, accessCode: e.target.value }))}
              helperText="Zu finden in den Druckereinstellungen unter 'Netzwerk'"
            />
            <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
              Hinweis: Stellen Sie sicher, dass auf dem Drucker:
              <ul>
                <li>Video in den Einstellungen aktiviert ist</li>
                <li>LAN Only Mode aktiviert ist</li>
                <li>Der Drucker neu gestartet wurde</li>
              </ul>
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)} disabled={isLoading}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleAddPrinter} 
              variant="contained"
              disabled={isLoading || !newPrinter.name || !newPrinter.ip || !newPrinter.accessCode}
            >
              {isLoading ? 'Verbinde...' : 'Hinzufügen'}
            </Button>
          </DialogActions>
        </Dialog>
      </ContentWrapper>
    </PageBackground>
  );
}

export default App; 