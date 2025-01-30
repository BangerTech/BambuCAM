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
    
    return new Promise((resolve) => {  // Kein reject Parameter nötig
      const ffmpeg = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', streamUrl,
        '-t', '1',
        '-f', 'null',
        '-'
      ]);

      let error = '';
      let success = false;

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('FFmpeg test output:', output);
        // Auch bei Fehlermeldungen können Frames empfangen werden
        if (output.includes('frame=')) {
          success = true;
        }
        error += output;
      });

      ffmpeg.on('close', (code) => {
        console.log('FFmpeg process closed with code:', code);
        console.log('Success:', success);
        resolve(success);  // Nutze die success Variable
        
        // Cleanup
        try {
          ffmpeg.kill('SIGKILL');
        } catch (e) {
          console.log('Cleanup error:', e);
        }
      });

      // Timeout nach 3 Sekunden
      setTimeout(() => {
        try {
          ffmpeg.kill('SIGKILL');
        } catch (e) {
          console.log('Timeout cleanup error:', e);
        }
        resolve(success);  // Nutze die success Variable
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
    const responseData = {
      ...cleanPrinterData,
      process: undefined  // Explizit ausschließen
    };
    
    // Intern mit Prozess speichern
    printers.set(cleanPrinterData.id, {
      ...cleanPrinterData,
      process: streamProcess
    });
    
    return responseData;
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