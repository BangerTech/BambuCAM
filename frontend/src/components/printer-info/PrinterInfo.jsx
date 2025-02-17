import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import BambuLabInfo from './BambuLabInfo';
import CrealityInfo from './CrealityInfo';

const PrinterInfo = ({ printer }) => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await api.getPrinterStatus(printer.id);
        setStatus(response.data);
      } catch (error) {
        console.error('Error fetching printer status:', error);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);

    return () => clearInterval(interval);
  }, [printer.id]);

  switch(printer.type) {
    case 'BAMBULAB':
      return <BambuLabInfo printer={printer} status={status} />;
    case 'CREALITY':
      return <CrealityInfo printer={printer} />;
    default:
      return null;
  }
};

export default PrinterInfo; 