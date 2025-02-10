import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  CircularProgress,
  Chip,
  Alert,
  DialogActions,
  Button,
  Box
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import styled from '@emotion/styled';

const GlassDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0, 255, 255, 0.2)',
    borderRadius: '15px',
    boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)',
    minWidth: '400px'
  }
}));

const CloudPrinterDialog = ({ open, onClose }) => {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      fetchPrinters();
    }
  }, [open]);

  const fetchPrinters = async () => {
    try {
      setLoading(true);
      setError(null); // Reset error state
      
      const response = await fetch(`${API_URL}/api/cloud/printers`);
      const data = await response.json();
      
      if (data.success) {
        setPrinters(data.printers || []);
      } else {
        setError(data.error || 'Failed to fetch printers');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrinter = async (printer) => {
    try {
      const response = await fetch(`${API_URL}/printers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: printer.name,
          ip: printer.id,
          type: 'CLOUD',
          access_code: printer.access_code
        }),
      });

      const data = await response.json();
      if (data.success) {
        onClose(true);  // true bedeutet Drucker wurde hinzugefügt
      }
    } catch (error) {
      console.error('Error adding printer:', error);
    }
  };

  return (
    <GlassDialog open={open} onClose={() => onClose(false)}>
      <DialogTitle>Cloud Printers</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : printers.length === 0 ? (
          <Alert severity="info">
            No cloud printers found. Please make sure you have printers registered in your Bambu Cloud account.
          </Alert>
        ) : (
          <List>
            {printers.map((printer) => (
              <ListItem
                key={printer.id}
                secondaryAction={
                  <IconButton edge="end" onClick={() => handleAddPrinter(printer)}>
                    <AddIcon />
                  </IconButton>
                }
              >
                <ListItemText 
                  primary={printer.name}
                  secondary={
                    <>
                      {printer.model} - {printer.status}
                      <Chip
                        size="small"
                        label={printer.online ? "Online" : "Offline"}
                        color={printer.online ? "success" : "error"}
                        sx={{ ml: 1 }}
                      />
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>Close</Button>
      </DialogActions>
    </GlassDialog>
  );
};

export default CloudPrinterDialog; 