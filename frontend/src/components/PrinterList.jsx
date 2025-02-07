import React, { useState, useCallback, useEffect } from 'react';
import { Box } from '@mui/material';
import PrinterCard from './PrinterCard';

const PrinterList = () => {
  const [printers, setPrinters] = useState([]);
  
  const fetchPrinters = useCallback(async () => {
    try {
      // Hole LAN Drucker
      const lanResponse = await fetch(`${API_URL}/printers`);
      const lanPrinters = await lanResponse.json();
      
      // Hole Cloud Drucker
      const cloudResponse = await fetch(`${API_URL}/api/cloud/printers`);
      const cloudPrinters = await cloudResponse.json();
      
      // Kombiniere beide Listen
      setPrinters([...lanPrinters, ...cloudPrinters]);
    } catch (error) {
      console.error('Error fetching printers:', error);
    }
  }, []);

  useEffect(() => {
    fetchPrinters();
    const interval = setInterval(fetchPrinters, 5000);
    return () => clearInterval(interval);
  }, [fetchPrinters]);

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {printers.map(printer => (
        <PrinterCard 
          key={printer.id} 
          printer={printer}
          isCloud={printer.type === 'cloud'}
        />
      ))}
    </Box>
  );
};

export default PrinterList; 