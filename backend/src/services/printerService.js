const { spawn } = require('child_process');
const printers = new Map();  // Wichtig: Map initialisieren
let nextPort = 9100;

const getNextPort = () => {
  return nextPort++;
};

const testRTSPConnection = async (streamUrl) => {
  try {
    console.log('Testing RTSP connection to:', streamUrl);
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', streamUrl,
        '-t', '1',  // Nur 1 Sekunde testen
        '-f', 'null',
        '-'
      ]);

      let error = '';

      ffmpeg.stderr.on('data', (data) => {
        error += data.toString();
        console.log('FFmpeg test output:', data.toString());
      });

      ffmpeg.on('close', (code) => {
        if (code === 0 || error.includes('frame=')) {
          console.log('RTSP connection test successful');
          resolve(true);
        } else {
          console.log('RTSP connection test failed:', error);
          resolve(false);
        }
      });

      // Timeout nach 5 Sekunden
      setTimeout(() => {
        ffmpeg.kill();
        resolve(false);
      }, 5000);
    });
  } catch (error) {
    console.error('Error testing RTSP connection:', error);
    return false;
  }
};

const startStream = async (printer) => {
  // Stream-Start-Logik hier...
  return null; // Temporär, bis die echte Stream-Logik implementiert ist
};

const addPrinter = async (printerData) => {
  try {
    const cleanPrinterData = {
      id: Date.now(),
      name: printerData.name,
      ipAddress: printerData.ipAddress,
      streamUrl: printerData.streamUrl,
      wsPort: getNextPort(),
      accessCode: printerData.accessCode,
      isMockPrinter: printerData.streamUrl.includes('mock-printer')
    };

    const streamProcess = await startStream(cleanPrinterData);
    
    const printerForStorage = {
      ...cleanPrinterData,
      process: null
    };
    
    printers.set(cleanPrinterData.id, {
      ...printerForStorage,
      process: streamProcess
    });
    
    return printerForStorage;
  } catch (error) {
    console.error('Error in addPrinter:', error);
    throw new Error(`Failed to add printer: ${error.message}`);
  }
};

const getAllPrinters = async () => {
  try {
    console.log('Getting all printers, count:', printers.size);
    return Array.from(printers.values()).map(printer => ({
      id: printer.id,
      name: printer.name,
      ipAddress: printer.ipAddress,
      streamUrl: printer.streamUrl,
      wsPort: printer.wsPort,
      isMockPrinter: printer.isMockPrinter
    }));
  } catch (error) {
    console.error('Error getting printers:', error);
    throw error;
  }
};

const deletePrinter = async (id) => {
  try {
    const printer = printers.get(id);
    if (printer && printer.process) {
      printer.process.kill();
    }
    return printers.delete(id);
  } catch (error) {
    console.error('Error deleting printer:', error);
    throw error;
  }
};

module.exports = {
  testRTSPConnection,
  addPrinter,
  getAllPrinters,
  deletePrinter
}; 