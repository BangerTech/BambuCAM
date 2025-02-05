import React, { useState } from 'react';
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
  Chip
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

const CloudPrinterDialog = ({ open, onClose, printers, onAddPrinter }) => {
  return (
    <GlassDialog open={open} onClose={onClose}>
      <DialogTitle>Available Cloud Printers</DialogTitle>
      <DialogContent>
        {printers.length === 0 ? (
          <Typography>
            No cloud printers found
          </Typography>
        ) : (
          <List>
            {printers.map((printer) => (
              <ListItem key={printer.id} divider>
                <ListItemText
                  primary={
                    <Typography color="white">
                      {printer.name}
                    </Typography>
                  }
                  secondary={
                    <Typography color="gray">
                      {printer.model}
                      <Chip
                        size="small"
                        label={printer.online ? "Online" : "Offline"}
                        color={printer.online ? "success" : "error"}
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton 
                    edge="end" 
                    onClick={() => onAddPrinter(printer)}
                    sx={{ 
                      color: '#00ffff',
                      '&:hover': {
                        color: '#fff',
                        background: 'rgba(0, 255, 255, 0.2)'
                      }
                    }}
                  >
                    <AddIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </GlassDialog>
  );
};

export default CloudPrinterDialog; 