import React, { useState, useEffect } from 'react';
import { Grid, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography } from '@mui/material';
import RTSPStream from './RTSPStream';

const PrinterGrid = () => {
  const [printers, setPrinters] = useState([]);
  const [open, setOpen] = useState(false);
  const [newPrinter, setNewPrinter] = useState({ name: '', ip: '', accessCode: '' });

  useEffect(() => {
    // Lade gespeicherte Drucker beim Start
    const savedPrinters = localStorage.getItem('printers');
    if (savedPrinters) {
      setPrinters(JSON.parse(savedPrinters));
    }
  }, []);

  const handleAddPrinter = () => {
    // Prüfe ob es ein Mock-Printer ist
    const isMockPrinter = newPrinter.ip.startsWith('mock-printer');
    
    // Baue die korrekte URL basierend auf Printer-Typ
    const streamUrl = isMockPrinter
      ? `rtsp://bblp:12345678@${newPrinter.ip}:8554/streaming/live/1`
      : `rtsps://bblp:${newPrinter.accessCode}@${newPrinter.ip}:322/streaming/live/1`;
    
    const printer = {
      id: Date.now(),
      name: newPrinter.name,
      url: streamUrl,
      accessCode: newPrinter.accessCode,
      isMockPrinter
    };

    const updatedPrinters = [...printers, printer];
    setPrinters(updatedPrinters);
    localStorage.setItem('printers', JSON.stringify(updatedPrinters));
    setOpen(false);
    setNewPrinter({ name: '', ip: '', accessCode: '' });
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
        <Button 
          variant="contained"
          onClick={() => setOpen(true)}
          sx={{ 
            bgcolor: '#007AFF',
            '&:hover': { bgcolor: '#0056b3' }
          }}
        >
          + Drucker hinzufügen
        </Button>
      </div>

      <Grid container spacing={2}>
        {printers.map((printer) => (
          <Grid item xs={12} sm={6} md={4} key={printer.id}>
            <Paper style={{ position: 'relative', overflow: 'hidden' }}>
              <Typography
                sx={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  padding: '0.5rem 1rem',
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: '#fff',
                  borderRadius: '4px',
                  zIndex: 10
                }}
              >
                {printer.name}
              </Typography>
              <RTSPStream url={printer.url} />
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Drucker hinzufügen</DialogTitle>
        <DialogContent>
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
        <DialogActions>
          <Button onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleAddPrinter}
            variant="contained"
          >
            Hinzufügen
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default PrinterGrid; 