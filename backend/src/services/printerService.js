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
    
    if (streamUrl.includes('mock-printer')) {
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
    const cleanPrinterData = {
      id: Date.now(),
      name: printerData.name,
      ipAddress: printerData.ipAddress,
      streamUrl: printerData.streamUrl,
      wsPort: getNextPort(),
      accessCode: printerData.accessCode,
      isMockPrinter: printerData.isMockPrinter
    };

    if (!cleanPrinterData.isMockPrinter) {
      console.log('Testing connection for real printer...');
      const isConnectable = await testRTSPConnection(cleanPrinterData.streamUrl);
      if (!isConnectable) {
        throw new Error('Could not connect to printer stream. Please check if LAN Mode is enabled and the Access Code is correct.');
      }
    }

    const streamProcess = await initStream(cleanPrinterData);
    
    // Nur die notwendigen Daten zurückgeben
    const responseData = {
      id: cleanPrinterData.id,
      name: cleanPrinterData.name,
      ipAddress: cleanPrinterData.ipAddress,
      streamUrl: cleanPrinterData.streamUrl,
      wsPort: cleanPrinterData.wsPort,
      isMockPrinter: cleanPrinterData.isMockPrinter
    };
    
    // Intern speichern
    printers.set(cleanPrinterData.id, {
      ...cleanPrinterData,
      processId: streamProcess ? streamProcess.pid : null
    });
    
    return responseData;
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

module.exports = {
  testRTSPConnection,
  addPrinter,
  getAllPrinters,
  deletePrinter
}; 