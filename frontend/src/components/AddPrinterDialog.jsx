import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel, Box, Typography, List, ListItem, ListItemText, IconButton, Collapse, Grid, Chip, Tabs, Tab, useTheme, useMediaQuery, Paper } from '@mui/material';
import styled from '@emotion/styled';
import InfoIcon from '@mui/icons-material/Info';
import { CircularProgress } from '@mui/material';
import { Logger, LOG_CATEGORIES } from '../utils/logger';

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
    color: theme.palette.mode === 'dark' ? '#00ffff' : '#333333'
  }
}));

const NeonButton = styled(Button)(({ theme }) => ({
  background: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
  color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  border: theme.palette.mode === 'dark' 
    ? '1px solid rgba(0, 255, 255, 0.3)' 
    : '1px solid rgba(0, 128, 128, 0.3)',
  '&:hover': {
    background: theme.palette.mode === 'dark' 
      ? 'rgba(0, 255, 255, 0.2)' 
      : 'rgba(0, 128, 128, 0.1)',
    boxShadow: theme.palette.mode === 'dark' 
      ? '0 0 20px rgba(0, 255, 255, 0.3)' 
      : '0 0 20px rgba(0, 128, 128, 0.2)'
  }
}));

const NeonTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    color: theme.palette.mode === 'dark' ? '#00ffff' : '#333333',
    '& fieldset': {
      borderColor: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 128, 128, 0.3)',
    },
    '&:hover fieldset': {
      borderColor: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(0, 128, 128, 0.5)',
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
    },
  },
  '& .MuiInputLabel-root': {
    color: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
    '&.Mui-focused': {
      color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
    },
  },
  '& .MuiInputBase-input': {
    color: theme.palette.mode === 'dark' ? '#00ffff' : '#333333',
  }
}));

const NeonSelect = styled(Select)(({ theme }) => ({
  color: theme.palette.mode === 'dark' ? '#00ffff' : '#333333',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 128, 128, 0.3)',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(0, 128, 128, 0.5)',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  },
  '& .MuiSvgIcon-root': {
    color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  }
}));

const NeonInputLabel = styled(InputLabel)(({ theme }) => ({
  color: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
  '&.Mui-focused': {
    color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  }
}));

const PrinterCard = styled(Box)(({ theme }) => ({
  background: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)',
  border: theme.palette.mode === 'dark' ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid rgba(0, 128, 128, 0.3)',
  borderRadius: '10px',
  padding: '16px',
  position: 'relative',
  cursor: 'pointer',
  marginBottom: '10px',
  transition: 'all 0.2s ease-in-out',
  boxShadow: theme.palette.mode === 'dark' ? '0 0 10px rgba(0, 255, 255, 0.1)' : '0 0 10px rgba(0, 128, 128, 0.1)',
}));

const ModeBadge = styled(Chip)(({ mode, theme }) => ({
  position: 'relative',
  float: 'right',
  marginBottom: '5px',
  backgroundColor: mode === 'lan' 
    ? (theme.palette.mode === 'dark' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(0, 180, 0, 0.1)')
    : (theme.palette.mode === 'dark' ? 'rgba(0, 150, 255, 0.3)' : 'rgba(0, 128, 128, 0.1)'),
  color: mode === 'lan' 
    ? (theme.palette.mode === 'dark' ? '#00ff00' : '#008800')
    : (theme.palette.mode === 'dark' ? '#00ffff' : '#008080'),
  border: mode === 'lan'
    ? `1px solid ${theme.palette.mode === 'dark' ? '#00ff00' : '#00aa00'}`
    : `1px solid ${theme.palette.mode === 'dark' ? '#00ffff' : '#008080'}`,
  fontSize: '0.75rem',
  height: '24px'
}));

const ScanButton = styled(Button)(({ theme }) => ({
  width: '100%',
  marginTop: '20px',
  marginBottom: '20px',
  padding: '10px',
  background: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
  color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
  border: theme.palette.mode === 'dark' ? '1px solid #00ffff' : '1px solid #008080',
  borderRadius: '8px',
  textTransform: 'none',
  fontSize: '1rem',
  '&:hover': {
    background: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.1)' : 'rgba(0, 128, 128, 0.1)',
    boxShadow: theme.palette.mode === 'dark' ? '0 0 15px rgba(0, 255, 255, 0.3)' : '0 0 15px rgba(0, 128, 128, 0.3)',
  },
  '&.Mui-disabled': {
    color: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 128, 128, 0.3)',
    borderColor: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 128, 128, 0.3)',
  }
}));

const PRINTER_TYPES = [
  { value: 'BAMBULAB', label: 'Bambu Lab' },
  { value: 'CREALITY', label: 'Creality / Moonraker' },
  { value: 'OCTOPRINT', label: 'OctoPrint' }
];

const SetupHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginBottom: '16px',
  '& .MuiTypography-root': {
    fontSize: '0.9rem',
    fontWeight: 500,
    color: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.9)' : 'rgba(0, 128, 128, 0.9)'
  },
  '& .MuiIconButton-root': {
    padding: '4px',
    marginLeft: '8px',
    '& .MuiSvgIcon-root': {
      fontSize: '1rem',
      color: theme.palette.mode === 'dark' ? '#00ffff' : '#008080'
    }
  }
}));

const PrinterTypeCard = styled(Paper)(({ selected, theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  background: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)',
  border: selected 
    ? theme.palette.mode === 'dark' ? '2px solid #00ffff' : '2px solid #008080'
    : theme.palette.mode === 'dark' ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid rgba(0, 128, 128, 0.3)',
  borderRadius: '10px',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    border: theme.palette.mode === 'dark' 
      ? '1px solid rgba(0, 255, 255, 0.8)' 
      : '1px solid rgba(0, 128, 128, 0.8)',
    boxShadow: theme.palette.mode === 'dark' 
      ? '0 0 15px rgba(0, 255, 255, 0.3)' 
      : '0 0 15px rgba(0, 128, 128, 0.3)',
    transform: 'translateY(-2px)'
  }
}));

const PrinterIcon = styled('img')(({ theme }) => ({
  width: '50px',
  height: '50px',
  filter: theme.palette.mode === 'dark'
    ? 'brightness(0) invert(1) sepia(100%) saturate(1000%) hue-rotate(155deg) brightness(0.9)'
    : 'brightness(0) invert(0.4) sepia(100%) saturate(1000%) hue-rotate(155deg) brightness(0.5)',
  opacity: 0.9,
  transition: 'all 0.2s ease',
  '&:hover': {
    opacity: 1,
    filter: theme.palette.mode === 'dark'
      ? 'brightness(0) invert(1) sepia(100%) saturate(1000%) hue-rotate(155deg) brightness(1)'
      : 'brightness(0) invert(0.4) sepia(100%) saturate(1000%) hue-rotate(155deg) brightness(0.6)'
  }
}));

// Guides for each printer type
const PRINTER_GUIDES = {
  BAMBULAB: {
    title: 'Bambu Lab Setup Guide',
    steps: [
      'Connect the printer to your network via LAN cable',
      'Enable LAN Mode Liveview:',
      '- Go to "Settings" (gear icon) > "General"',
      '- Enable "LAN Mode Liveview"',
      '- Note down the Access Code',
      'Find the IP address under:',
      '- Settings > Network > IP Address',
      'Click "Scan Network" or enter the IP manually'
    ]
  },
  CREALITY: {
    title: 'Creality/Moonraker Setup Guide',
    steps: [
      'Make sure your printer is running Klipper firmware',
      'Connect the printer to your network',
      'Access the Mainsail/Fluidd interface',
      'Enable the webcam stream in Moonraker settings',
      'Note down the printer\'s IP address',
      'The stream will be available at: http://IP:8080/?action=stream'
    ]
  },
  OCTOPRINT: {
    title: 'OctoPrint Setup Guide',
    steps: [
      'Install OctoPrint on your Raspberry Pi',
      'Connect the printer and webcam to the Pi',
      'Configure MQTT in OctoPrint settings:',
      '- Install "MQTT Plugin" from Plugin Manager',
      '- Configure broker address and port',
      'Enable webcam streaming in OctoPrint settings',
      'Note down the Pi\'s IP address'
    ]
  }
};

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
  const [selectedType, setSelectedType] = useState('BAMBULAB');
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
      <DialogTitle 
        sx={{ 
          borderBottom: theme => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.1)' : 'rgba(0, 128, 128, 0.1)'}`,
          textAlign: 'center',
          color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080'
        }}
      >
        Add Printer
      </DialogTitle>
      <DialogContent>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            mb: 2,
            '& .MuiTabs-flexContainer': {
              justifyContent: 'center'
            },
            '& .MuiTab-root': {
              color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
              '&.Mui-selected': {
                color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080'
            }
          }}
        >
          <Tab label="Manual" />
          <Tab label="Scan Network" />
        </Tabs>

        <Collapse in={activeTab === 0}>
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: isMobile ? 1 : 2,
            my: 3,
            width: '100%',
            '& > *': {
              height: isMobile ? '120px' : '200px',
              minWidth: isMobile ? '90px' : '150px',
            }
          }}>
            {PRINTER_TYPES.map((type) => (
              <PrinterTypeCard
                key={type.value}
                selected={selectedType === type.value}
                onClick={() => {
                  setSelectedType(type.value);
                  setPrinterData(prev => ({ ...prev, type: type.value }));
                }}
              >
                <Box sx={{ 
                  p: isMobile ? 1 : 2,
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: isMobile ? 1 : 2,
                  '& img': {
                    width: isMobile ? '40px' : '64px',
                    height: 'auto'
                  },
                  '& .MuiTypography-root': {
                    fontSize: isMobile ? '0.75rem' : '0.875rem',
                    whiteSpace: isMobile ? 'normal' : 'nowrap',
                    textAlign: 'center',
                    lineHeight: isMobile ? '1.2' : 'inherit'
                  }
                }}>
                  <PrinterIcon src="/3d-printer.png" alt={type.label} />
                  <Typography 
                    variant="body2" 
                    align="center"
                    sx={{ 
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {type.label}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGuide(prev => prev === type.value ? null : type.value);
                  }}
                  sx={{ 
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    color: theme => showGuide === type.value 
                      ? (theme.palette.mode === 'dark' ? '#00ffff' : '#008080') 
                      : (theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.6)' : 'rgba(0, 128, 128, 0.6)')
                  }}
                >
                  <InfoIcon fontSize={isMobile ? 'small' : 'medium'} />
                </IconButton>
              </PrinterTypeCard>
            ))}
          </Box>

          <Collapse in={!!showGuide}>
            <Box sx={{ 
              mb: 3, 
              p: 2, 
              border: theme => theme.palette.mode === 'dark' 
                ? '1px solid rgba(0, 255, 255, 0.2)' 
                : '1px solid rgba(0, 128, 128, 0.2)', 
              borderRadius: 1 
            }}>
              <Typography variant="subtitle2" sx={{ 
                mb: 1,
                color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080'
              }}>
                {PRINTER_GUIDES[showGuide]?.title}
              </Typography>
              <ol style={{ margin: 0, paddingLeft: '20px' }}>
                {PRINTER_GUIDES[showGuide]?.steps.map((step, index) => (
                  <li key={index} style={{ 
                    marginBottom: '4px',
                    color: 'inherit'
                  }}>
                    {step}
                  </li>
                ))}
              </ol>
            </Box>
          </Collapse>

          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>
            Manual Setup:
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Printer Type</InputLabel>
            <Select
              value={printerData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              label="Printer Type"
              sx={{ 
                color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#333333',
                '& .MuiSelect-icon': { color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(0, 128, 128, 0.5)'
                },
                '& .MuiPaper-root': {
                  backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)'
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                    border: theme => theme.palette.mode === 'dark' ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid rgba(0, 128, 128, 0.3)',
                    '& .MuiMenuItem-root': {
                      color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#333333',
                      '&:hover': {
                        backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.1)' : 'rgba(0, 128, 128, 0.1)'
                      },
                      '&.Mui-selected': {
                        backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.2)' : 'rgba(0, 128, 128, 0.2)',
                        '&:hover': {
                          backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 128, 128, 0.3)'
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
              <Typography variant="subtitle1" sx={{ mb: 1, color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>
                Found Printers:
              </Typography>
              <Grid container spacing={2}>
                {scannedPrinters.map((printer) => (
                  <Grid item xs={12} sm={6} key={printer.id}>
                    <PrinterCard 
                      key={printer.ip} 
                      onClick={() => handleScannedPrinterSelect(printer)}
                      sx={{
                        border: printerData.ip === printer.ip 
                          ? theme.palette.mode === 'dark' ? '2px solid #00ffff' : '2px solid #008080'
                          : theme.palette.mode === 'dark' ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid rgba(0, 128, 128, 0.3)',
                        boxShadow: printerData.ip === printer.ip 
                          ? theme.palette.mode === 'dark' ? '0 0 15px rgba(0, 255, 255, 0.3)' : '0 0 15px rgba(0, 128, 128, 0.3)'
                          : 'none',
                        transform: printerData.ip === printer.ip ? 'translateY(-2px)' : 'none',
                        '&:hover': {
                          border: printerData.ip === printer.ip 
                            ? theme.palette.mode === 'dark' ? '2px solid #00ffff' : '2px solid #008080'
                            : theme.palette.mode === 'dark' ? '1px solid rgba(0, 255, 255, 0.8)' : '1px solid rgba(0, 128, 128, 0.8)',
                          boxShadow: theme.palette.mode === 'dark' ? '0 0 15px rgba(0, 255, 255, 0.3)' : '0 0 15px rgba(0, 128, 128, 0.3)',
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      <ModeBadge 
                        label={printer.mode.toUpperCase()} 
                        mode={printer.mode}
                        size="small"
                      />
                      <Typography variant="h6" sx={{ 
                        color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#333333',
                        mb: 1,
                        fontSize: '1rem',
                        fontWeight: 500
                      }}>
                        {printer.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: theme => theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                        IP: {printer.ip}
                      </Typography>
                      <Typography variant="body2" sx={{ color: theme => theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                        Model: {printer.model}
                      </Typography>
                      {printer.serial && (
                        <Typography variant="body2" sx={{ color: theme => theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                          S/N: {printer.serial}
                        </Typography>
                      )}
                      {printer.version && (
                        <Typography variant="body2" sx={{ color: theme => theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
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