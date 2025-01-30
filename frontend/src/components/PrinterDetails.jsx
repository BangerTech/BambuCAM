import React, { useState, useEffect } from 'react';
import { Card, Typography, LinearProgress } from '@mui/material';

const PrinterDetails = ({ printer }) => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const response = await fetch(`${API_URL}/printers/${printer.id}/status`);
      const data = await response.json();
      setStatus(data);
    };

    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, [printer.id]);

  if (!status) return null;

  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="h6">{printer.name}</Typography>
      <Typography>
        Hotend: {status.temperatures.nozzle}°C
      </Typography>
      <Typography>
        Bed: {status.temperatures.bed}°C
      </Typography>
      {status.printTime.total > 0 && (
        <>
          <Typography>
            Remaining: {Math.floor(status.printTime.remaining / 60)}min
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={(1 - status.printTime.remaining / status.printTime.total) * 100} 
          />
        </>
      )}
    </Card>
  );
};

export default PrinterDetails; 