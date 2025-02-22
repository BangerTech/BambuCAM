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
    color: '#fff',
    '& .MuiDialogTitle-root': {
      borderBottom: '1px solid rgba(0, 255, 255, 0.1)',
      color: '#00ffff'
    },
    '& .MuiListItemText-primary': {
      color: '#fff',
      fontSize: '1.1rem'
    },
    '& .MuiListItemText-secondary': {
      color: 'rgba(255, 255, 255, 0.7)',
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
      margin: '0 10px'
    }
  }
}));

const CloudPrinterDialog = ({ open, onClose }) => {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      console.log('Dialog opened, fetching printers...');
      fetchPrinters();
    }
  }, [open]);

  const fetchPrinters = async () => {
    try {
      setLoading(true);
      console.log('Fetching cloud printers...');
      
      const response = await fetch(`${API_URL}/api/cloud/printers`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response:', {
        status: response.status,
        statusText: response.statusText
      });
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (Array.isArray(data) && data.length > 0) {
        console.log('Found printers:', data);
        const cloudPrinters = data.map(printer => {
          console.log('Mapping printer:', printer);
          return {
            name: printer.name,
            ip: null,
            accessCode: printer.access_code,
            model: printer.model,
            online: printer.online,
            isCloud: true,
            cloudId: printer.id,
            status: printer.status,
            type: 'CLOUD'
          };
        });
        console.log('Mapped printers:', cloudPrinters);
        setPrinters(cloudPrinters);
      } else {
        console.log('No printers found');
        setPrinters([]);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setError('Network error');
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