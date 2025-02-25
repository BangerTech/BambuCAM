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
import { Logger, LOG_CATEGORIES } from '../utils/logger';

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
      Logger.info(LOG_CATEGORIES.SYSTEM, 'Dialog opened, fetching printers...');
      fetchPrinters();
    }
  }, [open]);

  const fetchPrinters = async () => {
    try {
      setLoading(true);
      Logger.info(LOG_CATEGORIES.SYSTEM, 'Fetching cloud printers...');
      
      const response = await fetch(`${API_URL}/api/cloud/printers`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      Logger.debug(LOG_CATEGORIES.API, 'Cloud printers response:', {
        status: response.status,
        statusText: response.statusText
      });
      
      const data = await response.json();
      
      if (data.devices && Array.isArray(data.devices)) {
        Logger.debug(LOG_CATEGORIES.SYSTEM, 'Found printers:', data.devices);
        const cloudPrinters = data.devices.map(printer => ({
          name: printer.dev_name || printer.name,
          accessCode: printer.dev_access_code,
          model: printer.dev_product_name,
          online: printer.online,
          cloudId: printer.dev_id,
          status: printer.online ? 'online' : 'offline',
          type: 'CLOUD'
        }));
        Logger.debug(LOG_CATEGORIES.SYSTEM, 'Mapped printers:', cloudPrinters);
        setPrinters(cloudPrinters);
      } else {
        Logger.info(LOG_CATEGORIES.SYSTEM, 'No printers found');
        setPrinters([]);
      }
    } catch (error) {
      Logger.error(LOG_CATEGORIES.SYSTEM, 'Fetch error:', error);
      setError('Failed to load cloud printers. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrinter = async (printer) => {
    try {
      const printerData = {
        name: printer.name,
        type: 'CLOUD',
        cloudId: printer.cloudId,
        accessCode: printer.accessCode,
        model: printer.model,
        status: printer.status
      };

      Logger.debug(LOG_CATEGORIES.SYSTEM, 'Adding printer:', printerData);
      
      const response = await fetch(`${API_URL}/api/cloud/printers/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printerData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        Logger.error(LOG_CATEGORIES.API, 'Error adding printer:', errorData);
        throw new Error(errorData.error || 'Failed to add printer');
      }

      const result = await response.json();
      Logger.info(LOG_CATEGORIES.SYSTEM, 'Printer added successfully:', result);
      onClose(true);
    } catch (error) {
      Logger.error(LOG_CATEGORIES.SYSTEM, 'Error adding printer:', error);
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
                  secondary={
                    <Typography component="span" variant="body2">
                      Model: {printer.model || 'Unknown'}
                    </Typography>
                  }
                />
                <Chip 
                  label={printer.online ? "Online" : "Offline"}
                  color={printer.online ? "success" : "error"}
                  variant="outlined"
                  sx={{ mr: 1 }}
                />
                <IconButton 
                  onClick={() => handleAddPrinter(printer)}
                  disabled={!printer.online}
                  title={printer.online ? "Add Printer" : "Printer is offline"}
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