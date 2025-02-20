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

const API_URL = `http://${window.location.hostname}:4000`;

const GlassDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0, 255, 255, 0.2)',
    borderRadius: '15px',
    boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)',
    minWidth: '400px',
    color: '#00ffff',
    '& .MuiDialogTitle-root': {
      borderBottom: '1px solid rgba(0, 255, 255, 0.1)',
      color: '#00ffff'
    },
    '& .MuiListItemText-primary': {
      color: '#00ffff',
      fontSize: '1.1rem'
    },
    '& .MuiListItemText-secondary': {
      color: 'rgba(0, 255, 255, 0.7)',
      fontSize: '0.9rem'
    },
    '& .MuiIconButton-root': {
      color: '#00ffff',
      '&:hover': {
        backgroundColor: 'rgba(0, 255, 255, 0.1)'
      }
    },
    '& .MuiButton-root': {
      color: '#00ffff',
      '&:hover': {
        backgroundColor: 'rgba(0, 255, 255, 0.1)'
      }
    },
    '& .MuiChip-root': {
      margin: '0 10px',
      color: '#00ffff',
      borderColor: 'rgba(0, 255, 255, 0.5)'
    }
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
      const response = await fetch(`${API_URL}/api/cloud/printers`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setPrinters(data);
      }
    } catch (error) {
      console.error('Error fetching printers:', error);
      setError('Failed to fetch printers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrinter = async (printer) => {
    try {
      const printerData = {
        name: printer.name,
        type: 'CLOUD',
        cloudId: printer.dev_id,
        accessCode: printer.dev_access_code,
        model: printer.dev_product_name,
        status: printer.online ? 'online' : 'offline'
      };

      console.log('Sending printer data:', printerData);
      const response = await fetch(`${API_URL}/printers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printerData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to add printer');
      }

      const result = await response.json();
      console.log('Add printer result:', result);
      onClose(true);
    } catch (error) {
      console.error('Error adding printer:', error);
      setError(error.message);
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
              <ListItem key={printer.cloudId}>
                <ListItemText 
                  primary={printer.name}
                  secondary={`Model: ${printer.model}`}
                />
                <Chip 
                  label={printer.online ? "Online" : "Offline"}
                  color={printer.online ? "success" : "error"}
                />
                <IconButton onClick={() => handleAddPrinter(printer)}>
                  <AddIcon />
                </IconButton>
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