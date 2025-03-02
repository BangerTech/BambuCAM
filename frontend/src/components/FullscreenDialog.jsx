import React, { useEffect, useState, useRef } from 'react';
import { Dialog, IconButton, Box, Typography, AppBar, Toolbar, LinearProgress, Paper } from '@mui/material';
import { Close as CloseIcon, Delete as DeleteIcon } from '@mui/icons-material';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import RTSPStream from './RTSPStream';
import { Logger, LOG_CATEGORIES } from '../utils/logger';
import BambuLabInfo from './printer-info/BambuLabInfo';
import CrealityInfo from './printer-info/CrealityInfo';
import { API_URL } from '../config';
import EmergencyStopDialog from './EmergencyStopDialog';

const FullscreenDialog = ({ open, printer, onClose, onDelete }) => {
  const [printerData, setPrinterData] = useState({
    ...printer,
    status: 'offline',
    temperatures: { nozzle: 0, bed: 0, chamber: 0 },
    targets: { nozzle: 0, bed: 0 },
    progress: 0
  });
  const [isEmergencyStopping, setIsEmergencyStopping] = useState(false);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);

  useEffect(() => {
    if (open && printer) {
      const fetchStatus = async () => {
        try {
          const response = await fetch(`${API_URL}/printers/${printer.id}/status`);
          const data = await response.json();
          
          if (printer.type === 'BAMBULAB') {
            // Anpassung an das Format wie in PrinterCard
            setPrinterData(prev => ({
              ...prev,
              ...printer,
              status: data.status || 'offline',
              temps: data.temps || {}, // Original BambuLab temps
              temperatures: {
                hotend: data.temps?.nozzle || 0,
                bed: data.temps?.bed || 0,
                chamber: data.temps?.chamber || 0
              },
              targets: {
                hotend: data.temps?.nozzle_target || 0,
                bed: data.temps?.bed_target || 0
              },
              progress: data.progress || 0,
              remaining_time: data.remaining_time || 0
            }));
          } else {
            // Bestehende Verarbeitung für Creality bleibt unverändert
            setPrinterData(prev => ({
              ...prev,
              ...printer,
              status: data.status || 'offline',
              temperatures: {
                nozzle: data.temperatures?.hotend || data.temperatures?.nozzle || 0,
                bed: data.temperatures?.bed || 0,
                chamber: data.temperatures?.chamber || 0
              },
              targets: data.targets || { nozzle: 0, bed: 0 },
              progress: data.progress || 0
            }));
          }
        } catch (error) {
          Logger.error('Error fetching printer status:', error);
        }
      };

      fetchStatus();
      const interval = setInterval(fetchStatus, 2000);

      return () => clearInterval(interval);
    }
  }, [printer, open]);

  const handleEmergencyStop = async (printerId) => {
    setShowEmergencyDialog(true);
  };

  const confirmEmergencyStop = async () => {
    setShowEmergencyDialog(false);
    setIsEmergencyStopping(true);
    try {
      const response = await fetch(`${API_URL}/printers/${printer.id}/emergency_stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        Logger.printer('Emergency stop successful', { printer: printer.id });
      } else {
        Logger.printer('Emergency stop failed', { printer: printer.id, error: result.error || result.message });
        alert(`Error during emergency stop: ${result.error || result.message}`);
      }
    } catch (error) {
      Logger.printer('Emergency stop error', { printer: printer.id, error });
      alert(`Error during emergency stop: ${error.message}`);
    } finally {
      setIsEmergencyStopping(false);
    }
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          background: '#1a1a1a',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          boxShadow: '0 0 2rem rgba(0, 255, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          padding: '2rem'
        }
      }}
    >
      <Paper 
        sx={{ 
          flex: 1,
          background: '#000',
          borderRadius: '1rem',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <AppBar 
          position="relative" 
          sx={{ 
            background: 'rgba(0,0,0,0.9)',
            boxShadow: 'none'
          }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={onClose}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              {printer?.name} ({printer?.ip})
            </Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => {
                onDelete(printer);
                onClose();
              }}
              aria-label="delete"
            >
              <DeleteIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, position: 'relative' }}>
          <RTSPStream 
            printer={printerData} 
            fullscreen 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              background: '#000'
            }}
            autoPlay
            playsInline
            muted
          />
          
          {/* Status Overlay */}
          <Box sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '20px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography>
                {printer.type === 'BAMBULAB' ? (
                  `Hotend: ${printerData.temps?.nozzle || 0}°C`
                ) : (
                  `Hotend: ${printerData.temperatures?.nozzle || 0}°C`
                )}
              </Typography>
              <Typography>
                {printer.type === 'BAMBULAB' ? (
                  `Bed: ${printerData.temps?.bed || 0}°C`
                ) : (
                  `Bed: ${printerData.temperatures?.bed || 0}°C`
                )}
              </Typography>
              <Typography>
                {printer.type === 'BAMBULAB' ? (
                  `Chamber: ${printerData.temps?.chamber || 0}°C`
                ) : (
                  `Chamber: ${printerData.temperatures?.chamber || 0}°C`
                )}
              </Typography>
            </Box>
            
            <Box sx={{ mt: 2 }}>
              <LinearProgress 
                variant="determinate"
                value={printerData?.progress || 0}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#4caf50'
                  }
                }}
              />
              <Typography sx={{ mt: 1, textAlign: 'center' }}>
                {printerData?.remaining_time || 0} min remaining
              </Typography>
            </Box>
          </Box>
        </Box>

        {printer?.type === 'BAMBULAB' ? (
          <BambuLabInfo printer={printerData} fullscreen={true} onEmergencyStop={handleEmergencyStop} />
        ) : (
          <CrealityInfo printer={printerData} fullscreen={true} onEmergencyStop={handleEmergencyStop} />
        )}

        {isEmergencyStopping && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <Typography sx={{ color: '#fff', fontWeight: 'bold' }}>
              Executing emergency stop...
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Emergency Stop Dialog */}
      <EmergencyStopDialog
        open={showEmergencyDialog}
        onClose={() => setShowEmergencyDialog(false)}
        onConfirm={confirmEmergencyStop}
        printerName={printer?.name}
      />
    </Dialog>
  );
};

export default FullscreenDialog; 