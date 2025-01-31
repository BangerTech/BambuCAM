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
    
    if (!streamUrl) {
      throw new Error('No stream URL provided');
    }

    const isMockPrinter = streamUrl.includes('mock-printer');
    
    if (isMockPrinter) {
      console.log('Mock printer detected, skipping RTSP test');
      return true;
    }

    return new Promise((resolve) => {
      let ffmpegProcess = null;
      let timeoutId = null;
      let isResolved = false;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (ffmpegProcess) {
          try {
            ffmpegProcess.kill('SIGKILL');
            ffmpegProcess = null;
          } catch (e) {
            console.log('Cleanup error:', e);
          }
        }
      };

      const resolveOnce = (value) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve(value);
        }
      };

      ffmpegProcess = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-rtsp_flags', 'prefer_tcp',
        '-allowed_media_types', 'video',
        '-analyzeduration', '100000',
        '-probesize', '100000',
        '-i', streamUrl,
        '-t', '1',
        '-f', 'null',
        '-'
      ]);

      ffmpegProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('FFmpeg test output:', output);
        
        if (output.includes('frame=') || 
            output.includes('Stream mapping:') || 
            output.includes('Opening') ||
            output.includes('Video:')) {
          resolveOnce(true);
        }
      });

      ffmpegProcess.on('close', (code) => {
        console.log('FFmpeg process closed with code:', code);
        resolveOnce(code === 0 || code === 1);
      });

      ffmpegProcess.on('error', (error) => {
        console.error('FFmpeg process error:', error);
        resolveOnce(false);
      });

      setTimeout(() => {
        console.log('RTSP test timeout');
        resolveOnce(false);
      }, 8000);
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
    // Generiere eine eindeutige ID
    const id = Date.now();
    const wsPort = 9100 + printers.size; // Dynamischer Port für jeden Drucker

    // Erstelle sauberes Drucker-Objekt
    const cleanPrinterData = {
      id,
      name: printerData.name,
      ipAddress: printerData.ipAddress,
      streamUrl: printerData.streamUrl,
      wsPort: wsPort,
      accessCode: printerData.accessCode,
      isMockPrinter: printerData.isMockPrinter
    };

    // Teste RTSP-Verbindung
    await testRTSPConnection(cleanPrinterData.streamUrl);

    // Starte Stream
    await initStream(cleanPrinterData);

    // Speichere Drucker
    printers.set(cleanPrinterData.id, cleanPrinterData);

    return {
      success: true,
      printer: cleanPrinterData
    };
  } catch (error) {
    console.error('Error in addPrinter:', error);
    throw error;
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

const getPrinterStatus = async (printerId) => {
  try {
    const printer = printers.get(printerId);
    if (!printer) {
      throw new Error('Printer not found');
    }

    // Mock-Status für Test-Drucker
    if (printer.isMockPrinter) {
      return {
        temperatures: {
          bed: 25 + Math.random() * 5,
          nozzle: 28 + Math.random() * 5
        },
        printTime: {
          remaining: 0,
          total: 0
        },
        status: 'online',
        progress: 0,
        material: 'PLA',
        speed: 100,
        fan_speed: 100,
        layer: 1,
        total_layers: 100
      };
    }

    // Hier später echte Drucker-Status-Abfrage implementieren
    return {
      status: 'unknown'
    };
  } catch (error) {
    console.error('Error getting printer status:', error);
    throw error;
  }
};

module.exports = {
  testRTSPConnection,
  addPrinter,
  getAllPrinters,
  deletePrinter,
  getPrinterStatus
}; 