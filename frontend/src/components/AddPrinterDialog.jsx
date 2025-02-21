import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel, Box, Typography, List, ListItem, ListItemText, IconButton, Collapse, Grid, Chip, Tabs, Tab } from '@mui/material';
import styled from '@emotion/styled';
import InfoIcon from '@mui/icons-material/Info';
import { CircularProgress } from '@mui/material';
import { Logger, LOG_CATEGORIES } from '../utils/logger';

const GlassDialog = styled(Dialog)({
  '& .MuiDialog-paper': {
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0, 255, 255, 0.2)',
    borderRadius: '15px',
    boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)',
    color: '#00ffff'
  }
});

const NeonButton = styled(Button)({
  background: 'rgba(0, 0, 0, 0.8)',
  color: '#00ffff',
  border: '1px solid rgba(0, 255, 255, 0.3)',
  '&:hover': {
    background: 'rgba(0, 255, 255, 0.2)',
    boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)'
  }
});

const NeonTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'rgba(0, 255, 255, 0.5)'
    },
    '&:hover fieldset': {
      borderColor: 'rgba(0, 255, 255, 0.5)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#00ffff',
    }
  },
  '& .MuiInputLabel-root': {
    color: '#00ffff'
  },
  '& .MuiInputBase-input': {
    color: '#00ffff'
  }
});

const PrinterCard = styled(Box)(({ theme }) => ({
  background: 'rgba(0, 0, 0, 0.6)',
  borderRadius: '10px',
  padding: '15px',
  border: '1px solid rgba(0, 255, 255, 0.3)',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  '&:hover': {
    border: '1px solid rgba(0, 255, 255, 0.8)',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)',
    transform: 'translateY(-2px)'
  }
}));

const ModeBadge = styled(Chip)(({ mode }) => ({
  position: 'absolute',
  top: '10px',
  right: '10px',
  backgroundColor: mode === 'lan' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(0, 150, 255, 0.2)',
  color: mode === 'lan' ? '#00ff00' : '#00ffff',
  border: `1px solid ${mode === 'lan' ? '#00ff00' : '#00ffff'}`,
  fontSize: '0.75rem',
  height: '24px'
}));

const ScanButton = styled(Button)({
  width: '100%',
  marginTop: '20px',
  marginBottom: '20px',
  padding: '10px',
  background: 'rgba(0, 0, 0, 0.8)',
  color: '#00ffff',
  border: '1px solid #00ffff',
  borderRadius: '8px',
  textTransform: 'none',
  fontSize: '1rem',
  '&:hover': {
    background: 'rgba(0, 255, 255, 0.1)',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)',
  },
  '&.Mui-disabled': {
    color: 'rgba(0, 255, 255, 0.3)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
  }
});

const PRINTER_TYPES = [
  { value: 'BAMBULAB', label: 'Bambu Lab' },
  { value: 'CREALITY', label: 'Creality / Moonraker' },
  { value: 'OCTOPRINT', label: 'OctoPrint' }
];

const SetupHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  marginBottom: '16px',
  '& .MuiTypography-root': {
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'rgba(0, 255, 255, 0.9)'
  },
  '& .MuiIconButton-root': {
    padding: '4px',
    marginLeft: '8px',
    '& .MuiSvgIcon-root': {
      fontSize: '1rem'
    }
  }
});

const AddPrinterDialog = ({ 
  open, 
  onClose, 
  onAdd, 
  isAdding,
  isDarkMode,
  scannedPrinters = [],
  isScanning,
  scanTimer,
  onScan
}) => {
  const [showGuide, setShowGuide] = useState(false);
  const [printerData, setPrinterData] = useState({
    name: '',
    ip: '',
    type: 'BAMBULAB',
    accessCode: '',
    mqttBroker: 'localhost',
    mqttPort: 1883,
    cloudId: '',
    model: '',
    status: ''
  });
  const [activeTab, setActiveTab] = useState(0);

  const handleScannedPrinterSelect = (printer) => {
    setPrinterData({
      name: printer.name,
      ip: printer.ip,
      type: 'BAMBULAB',
      accessCode: printer.dev_access_code || '',
      cloudId: printer.dev_id || '',
      model: printer.dev_product_name || '',
      status: printer.online ? 'online' : 'offline'
    });
  };

  const handleInputChange = (field, value) => {
    setPrinterData({
      ...printerData,
      [field]: value
    });
  };

  const renderTypeSpecificFields = () => {
    switch(printerData.type) {
      case 'BAMBULAB':
        return (
          <NeonTextField
            label="Access Code"
            value={printerData.accessCode}
            onChange={(e) => handleInputChange('accessCode', e.target.value)}
            fullWidth
            margin="normal"
          />
        );
      
      case 'OCTOPRINT':
        return (
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <NeonTextField
                label="MQTT Broker"
                value={printerData.mqttBroker}
                onChange={(e) => handleInputChange('mqttBroker', e.target.value)}
                fullWidth
                margin="normal"
                helperText="MQTT Broker URL (default: localhost)"
              />
            </Grid>
            <Grid item xs={4}>
              <NeonTextField
                label="MQTT Port"
                value={printerData.mqttPort}
                onChange={(e) => handleInputChange('mqttPort', e.target.value)}
                type="number"
                fullWidth
                margin="normal"
                helperText="default: 1883"
              />
            </Grid>
          </Grid>
        );
      
      default:
        return null;
    }
  };

  const handleAdd = () => {
    const submitData = {
      ...printerData,
      streamUrl: printerData.type === 'BAMBULAB' 
        ? `rtsps://bblp:${printerData.accessCode}@${printerData.ip}:322/streaming/live/1`
        : printerData.type === 'OCTOPRINT'
          ? `http://${printerData.ip}/webcam/?action=stream`
          : `http://${printerData.ip}:8080/?action=stream`,
      cloudId: printerData.cloudId,
      model: printerData.model,
      status: printerData.status
    };
    onAdd(submitData);
  };

  return (
    <GlassDialog open={open} onClose={onClose}>
      <DialogTitle>Add Printer</DialogTitle>
      <DialogContent>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            mb: 2,
            '& .MuiTab-root': {
              color: '#00ffff',
              '&.Mui-selected': {
                color: '#00ffff'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#00ffff'
            }
          }}
        >
          <Tab label="Manual" />
          <Tab label="Scan Network" />
        </Tabs>

        <Collapse in={activeTab === 0}>
          <SetupHeader>
            <Typography variant="subtitle2">
              BambuLab Printer Setup
            </Typography>
            <IconButton 
              onClick={() => setShowGuide(!showGuide)}
              size="small"
              sx={{ 
                color: showGuide ? '#00ffff' : 'rgba(0, 255, 255, 0.6)',
                '&:hover': {
                  color: '#00ffff'
                }
              }}
            >
              <InfoIcon fontSize="small" />
            </IconButton>
          </SetupHeader>

          <Collapse in={showGuide}>
            <Box sx={{ mb: 3, mt: 2 }}>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Connect the printer to your network via LAN cable</li>
                <li>Enable LAN Mode Liveview:
                  <ul>
                    <li>Go to "Settings" (gear icon) > "General"</li>
                    <li>Enable "LAN Mode Liveview"</li>
                    <li>Note down the Access Code</li>
                  </ul>
                </li>
                <li>Find the IP address under:
                  <ul>
                    <li>Settings > Network > IP Address</li>
                  </ul>
                </li>
                <li>Click "Scan Network" or enter the IP manually</li>
              </ol>
            </Box>
          </Collapse>

          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, color: '#00ffff' }}>
            Manual Setup:
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Printer Type</InputLabel>
            <Select
              value={printerData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              label="Printer Type"
              sx={{ 
                color: '#00ffff',
                '& .MuiSelect-icon': { color: '#00ffff' },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 255, 255, 0.5)'
                },
                '& .MuiPaper-root': {
                  backgroundColor: 'rgba(0, 0, 0, 0.9)'
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: 'rgba(0, 0, 0, 0.9)',
                    border: '1px solid rgba(0, 255, 255, 0.3)',
                    '& .MuiMenuItem-root': {
                      color: '#00ffff',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 255, 255, 0.1)'
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(0, 255, 255, 0.2)',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 255, 255, 0.3)'
                        }
                      }
                    }
                  }
                }
              }}
            >
              {PRINTER_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <NeonTextField
            label="Printer Name"
            value={printerData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            fullWidth
          />

          <NeonTextField
            label="IP Address"
            value={printerData.ip}
            onChange={(e) => handleInputChange('ip', e.target.value)}
            fullWidth
          />

          {renderTypeSpecificFields()}
        </Collapse>

        <Collapse in={activeTab === 1}>
          <ScanButton
            onClick={onScan}
            disabled={isScanning}
            startIcon={isScanning && <CircularProgress size={20} color="inherit" />}
          >
            {isScanning ? `Scanning... (${scanTimer}s)` : 'SCAN NETWORK'}
          </ScanButton>

          {scannedPrinters.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1, color: '#00ffff' }}>
                Found Printers:
              </Typography>
              <Grid container spacing={2}>
                {scannedPrinters.map((printer) => (
                  <Grid item xs={12} sm={6} key={printer.id}>
                    <PrinterCard 
                      onClick={() => handleScannedPrinterSelect(printer)}
                      sx={{ position: 'relative', minHeight: '140px' }}
                    >
                      <ModeBadge 
                        label={printer.mode.toUpperCase()} 
                        mode={printer.mode}
                        size="small"
                      />
                      <Typography variant="h6" sx={{ 
                        color: '#00ffff',
                        mb: 1,
                        fontSize: '1rem',
                        fontWeight: 500
                      }}>
                        {printer.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
                        IP: {printer.ip}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
                        Model: {printer.model}
                      </Typography>
                      {printer.serial && (
                        <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
                          S/N: {printer.serial}
                        </Typography>
                      )}
                      {printer.version && (
                        <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)' }}>
                          Version: {printer.version}
                        </Typography>
                      )}
                    </PrinterCard>
                  </Grid>
                ))}
              </Grid>

              <Collapse in={printerData.ip !== ''}>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(0, 255, 255, 0.1)' }}>
                  <NeonTextField
                    label="Access Code"
                    value={printerData.accessCode}
                    onChange={(e) => handleInputChange('accessCode', e.target.value)}
                    fullWidth
                  />
                </Box>
              </Collapse>
            </Box>
          )}
        </Collapse>
      </DialogContent>
      
      <DialogActions>
        <NeonButton onClick={onClose}>Cancel</NeonButton>
        <NeonButton onClick={handleAdd} disabled={isAdding}>
          {isAdding ? <CircularProgress size={24} /> : 'Add'}
        </NeonButton>
      </DialogActions>
    </GlassDialog>
  );
};

export default AddPrinterDialog; 