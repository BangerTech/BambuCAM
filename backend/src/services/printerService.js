const { spawn } = require('child_process');
const printers = new Map();  // Wichtig: Map initialisieren
let nextPort = 9100;
const { startStream: initStream, stopStream } = require('./streamService');

const getNextPort = () => {
  return nextPort++;
};

const testRTSPConnection = async (streamUrl) => {
  try {
    console.log('Testing RTSP connection to:', streamUrl);
    
    return new Promise((resolve) => {
      let ffmpegProcess = null;
      let timeoutId = null;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (ffmpegProcess) {
          try {
            ffmpegProcess.kill('SIGKILL');
          } catch (e) {
            console.log('Cleanup error:', e);
          }
        }
      };

      ffmpegProcess = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', streamUrl,
        '-t', '1',
        '-f', 'null',
        '-'
      ]);

      let success = false;

      ffmpegProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('FFmpeg test output:', output);
        if (output.includes('frame=')) {
          success = true;
          cleanup();
          resolve(true);
        }
      });

      ffmpegProcess.on('close', (code) => {
        cleanup();
        resolve(success);
      });

      timeoutId = setTimeout(() => {
        cleanup();
        resolve(success);
      }, 3000);
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

    // Teste die Verbindung für echte Drucker
    if (!cleanPrinterData.isMockPrinter) {
      console.log('Testing connection for real printer...');
      const isConnectable = await testRTSPConnection(cleanPrinterData.streamUrl);
      if (!isConnectable) {
        throw new Error('Could not connect to printer stream');
      }
    }

    // Stream starten
    const streamProcess = await initStream(cleanPrinterData);
    
    // Nur die sauberen Daten für die Antwort
    const responseData = { ...cleanPrinterData };
    delete responseData.process;  // Sicherstellen, dass kein Prozess-Objekt dabei ist
    
    // Intern mit Prozess speichern
    const storageData = { ...cleanPrinterData };
    if (streamProcess) {
      storageData.process = {
        pid: streamProcess.pid  // Nur die PID speichern
      };
    }
    
    printers.set(cleanPrinterData.id, storageData);
    
    return responseData;
  } catch (error) {
    console.error('Error in addPrinter:', error);
    throw new Error(`Failed to add printer: ${error.message}`);
  }
};

const getAllPrinters = async () => {
  try {
    console.log('Getting all printers, count:', printers.size);
    return Array.from(printers.values()).map(printer => {
      const cleanPrinter = { ...printer };
      delete cleanPrinter.process;  // Prozess-Objekt entfernen
      return cleanPrinter;
    });
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