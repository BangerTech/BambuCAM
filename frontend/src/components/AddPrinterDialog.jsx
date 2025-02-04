import React, { useState } from 'react';
import { FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, TextField } from '@mui/material';

const [mode, setMode] = useState('lan'); // 'lan' oder 'cloud'
const [cloudCredentials, setCloudCredentials] = useState({
  email: '',
  password: ''
});

<FormControl fullWidth sx={{ mb: 2 }}>
  <FormLabel>Verbindungsmodus</FormLabel>
  <RadioGroup value={mode} onChange={(e) => setMode(e.target.value)}>
    <FormControlLabel value="lan" control={<Radio />} label="LAN (Direkte Verbindung)" />
    <FormControlLabel value="cloud" control={<Radio />} label="Cloud (Bambulab Account)" />
  </RadioGroup>
</FormControl>

{mode === 'cloud' && (
  <>
    <TextField
      label="Email"
      value={cloudCredentials.email}
      onChange={(e) => setCloudCredentials(prev => ({...prev, email: e.target.value}))}
      fullWidth
      sx={{ mb: 2 }}
    />
    <TextField
      label="Passwort"
      type="password"
      value={cloudCredentials.password}
      onChange={(e) => setCloudCredentials(prev => ({...prev, password: e.target.value}))}
      fullWidth
      sx={{ mb: 2 }}
    />
  </>
)} 