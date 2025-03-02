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
    background: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    border: theme.palette.mode === 'dark' 
      ? '1px solid rgba(0, 255, 255, 0.2)' 
      : '1px solid rgba(0, 128, 128, 0.2)',
    borderRadius: '15px',
    boxShadow: theme.palette.mode === 'dark' 
      ? '0 0 30px rgba(0, 255, 255, 0.2)' 
      : '0 0 30px rgba(0, 128, 128, 0.1)',
    minWidth: '400px',
    color: theme.palette.mode === 'dark' ? '#00ffff' : '#333333',
    '& .MuiDialogTitle-root': {
      borderBottom: theme.palette.mode === 'dark' 
        ? '1px solid rgba(0, 255, 255, 0.1)' 
        : '1px solid rgba(0, 128, 128, 0.1)',
      color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080'
    },
    '& .MuiListItemText-primary': {
      color: theme.palette.mode === 'dark' ? '#00ffff' : '#333333',
      fontSize: '1.1rem'
    },
    '& .MuiListItemText-secondary': {
      color: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
      fontSize: '0.9rem'
    },
    '& .MuiIconButton-root': {
      color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
      '&:hover': {
        backgroundColor: theme.palette.mode === 'dark' 
          ? 'rgba(0, 255, 255, 0.1)' 
          : 'rgba(0, 128, 128, 0.1)'
      }
    },
    '& .MuiButton-root': {
      color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
      '&:hover': {
        backgroundColor: theme.palette.mode === 'dark' 
          ? 'rgba(0, 255, 255, 0.1)' 
          : 'rgba(0, 128, 128, 0.1)'
      }
    },
    '& .MuiChip-root': {
      margin: '0 10px',
      color: theme.palette.mode === 'dark' ? '#00ffff' : '#333333',
      borderColor: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(0, 128, 128, 0.5)'
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
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include',
        mode: 'cors'
      });
      
      console.log('Response:', {
        status: response.status,
        statusText: response.statusText
      });

      const data = await response.json();
      console.log('Response data:', data);
      
      // Handle 2FA requirement
      if (data.error === '2fa_required' || data.message?.includes('2fa')) {
        setError('Two-factor authentication required. Please complete 2FA in your Bambu account.');
        setPrinters([]);
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (data && Array.isArray(data)) {
        console.log('Found printers:', data);
        const cloudPrinters = data.map(printer => {
          // Ensure we have a valid cloudId
          const cloudId = printer.dev_id || printer.id || printer.cloudId;
          if (!cloudId) {
            console.warn('Printer missing cloudId:', printer);
          }

          // Check if printer is online based on ACTIVE status
          const isOnline = printer.status === 'ACTIVE' || printer.print_status === 'ACTIVE';

          const mappedPrinter = {
            name: printer.dev_name || printer.name || 'Unknown Printer',
            accessCode: printer.dev_access_code || printer.access_code,
            model: printer.dev_product_name || printer.dev_model_name || printer.model || 'Unknown Model',
            cloudId: cloudId,
            online: isOnline,  // Set online based on ACTIVE status
            status: isOnline ? 'online' : 'offline',
            nozzle_diameter: printer.nozzle_diameter || 0.4,
            type: 'CLOUD',
            dev_id: printer.dev_id,
            id: printer.id,
            print_status: printer.print_status || 'unknown'
          };
          console.log('Mapped printer:', mappedPrinter);
          return mappedPrinter;
        }).filter(printer => printer.cloudId); // Only keep printers with valid cloudId

        console.log('Mapped printers:', cloudPrinters);
        setPrinters(cloudPrinters);
      } else {
        console.log('No printers found or invalid data format:', data);
        setPrinters([]);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setError(error.message || 'Network error');
      setPrinters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrinter = async (printer) => {
    try {
      console.log('Adding printer:', printer);
      const printerData = {
        name: printer.name,
        type: 'CLOUD',
        cloudId: printer.cloudId || printer.dev_id,
        accessCode: printer.accessCode || printer.dev_access_code,
        model: printer.model,
        status: printer.status,
        nozzle_diameter: printer.nozzle_diameter,
        print_status: printer.print_status || 'unknown'
      };

      console.log('Sending printer data:', printerData);
      
      if (!printerData.cloudId || !printerData.accessCode) {
        console.error('Missing required data:', {
          cloudId: printerData.cloudId,
          accessCode: printerData.accessCode
        });
        throw new Error('Missing required cloud printer data (cloudId or accessCode)');
      }

      const response = await fetch(`${API_URL}/api/cloud/printers/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
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
              <ListItem key={`${printer.cloudId}-${printer.name}`}>
                <ListItemText 
                  primary={printer.name}
                  secondary={
                    <Typography component="span" variant="body2">
                      Model: {printer.model || 'Unknown'}
                    </Typography>
                  }
                />
                <Chip 
                  label={printer.status === 'ACTIVE' || printer.print_status === 'ACTIVE' ? "Online" : "Offline"}
                  color={printer.status === 'ACTIVE' || printer.print_status === 'ACTIVE' ? "success" : "error"}
                  variant="outlined"
                  sx={{ mr: 1 }}
                />
                <IconButton 
                  onClick={() => handleAddPrinter(printer)}
                  disabled={!(printer.status === 'ACTIVE' || printer.print_status === 'ACTIVE')}
                  title={printer.status === 'ACTIVE' || printer.print_status === 'ACTIVE' ? "Add Printer" : "Printer is offline"}
                >
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