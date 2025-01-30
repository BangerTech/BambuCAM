const addPrinter = async (printerData) => {
  try {
    // Bereinige die Daten vor dem Speichern
    const cleanPrinterData = {
      id: Date.now(),
      name: printerData.name,
      ipAddress: printerData.ipAddress,
      streamUrl: printerData.streamUrl,
      wsPort: getNextPort(),
      accessCode: printerData.accessCode
    };

    // Starte den Stream
    await startStream(cleanPrinterData);

    // Speichere nur die notwendigen Daten
    printers.set(cleanPrinterData.id, cleanPrinterData);
    
    return cleanPrinterData;
  } catch (error) {
    console.error('Error in addPrinter:', error);
    throw new Error(`Failed to add printer: ${error.message}`);
  }
}; 