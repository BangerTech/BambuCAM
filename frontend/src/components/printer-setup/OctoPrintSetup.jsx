import React, { useState } from 'react';
import {
  TextField,
  Box,
  Typography,
  Alert
} from '@mui/material';
import { styled } from '@mui/material/styles';

const GlassBox = styled(Box)(({ theme }) => ({
  background: 'rgba(0, 0, 0, 0.3)',
  backdropFilter: 'blur(10px)',
  borderRadius: '10px',
  padding: '20px',
  border: '1px solid rgba(0, 255, 255, 0.1)'
}));

const OctoPrintSetup = ({ onDataChange, error }) => {
  const [formData, setFormData] = useState({
    ip: '',
    apiKey: '',
    name: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };
    setFormData(newData);
    onDataChange(newData);
  };

  return (
    <GlassBox>
      <Typography variant="h6" sx={{ color: '#00ffff', mb: 2 }}>
        OctoPrint Configuration
      </Typography>
      
      <TextField
        fullWidth
        name="name"
        label="Printer Name"
        value={formData.name}
        onChange={handleChange}
        sx={{ mb: 2 }}
        variant="outlined"
      />

      <TextField
        fullWidth
        name="ip"
        label="IP Address"
        value={formData.ip}
        onChange={handleChange}
        sx={{ mb: 2 }}
        placeholder="192.168.1.100"
        variant="outlined"
      />

      <TextField
        fullWidth
        name="apiKey"
        label="API Key"
        value={formData.apiKey}
        onChange={handleChange}
        sx={{ mb: 2 }}
        type="password"
        variant="outlined"
      />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="body2" sx={{ color: 'rgba(0, 255, 255, 0.7)', mt: 2 }}>
        You can find your API key in OctoPrint's settings under "API" tab
      </Typography>
    </GlassBox>
  );
};

export default OctoPrintSetup; 