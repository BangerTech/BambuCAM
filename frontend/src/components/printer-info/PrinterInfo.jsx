import React from 'react';
import BambuLabInfo from './BambuLabInfo';
import CrealityInfo from './CrealityInfo';
import logger from '../../utils/logger';

const PrinterInfo = ({ printer, status, onEmergencyStop }) => {
  // Daten-Mapping für unterschiedliche Druckertypen
  const mappedStatus = printer?.type === 'CREALITY' ? {
    ...status,
    temperatures: status?.temps,  // Für Creality: temps -> temperatures
  } : status;

  // Erweitertes Debug-Logging
  logger.debug('PrinterInfo render:', {
    printer_type: printer?.type,
    printer_id: printer?.id,
    status: mappedStatus,
    temperatures: mappedStatus?.temperatures,
    targets: mappedStatus?.targets,
    progress: mappedStatus?.progress
  });

  // Wähle die richtige Info-Komponente basierend auf dem Druckertyp
  switch (printer?.type) {
    case 'BAMBULAB':
      return <BambuLabInfo printer={printer} status={mappedStatus} onEmergencyStop={onEmergencyStop} />;
    case 'CREALITY':
      return <CrealityInfo printer={printer} status={mappedStatus} onEmergencyStop={onEmergencyStop} />;
    default:
      logger.warn(`Unknown printer type: ${printer?.type}`);
      return null;
  }
};

export default PrinterInfo; 