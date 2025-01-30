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

      // Angepasste Parameter für BambuLab Kamera
      ffmpegProcess = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',        // TCP für stabilere Verbindung
        '-rtsp_flags', 'prefer_tcp',     // TCP bevorzugen
        '-allowed_media_types', 'video', // Nur Video
        '-analyzeduration', '100000',    // Schnellere Analyse
        '-probesize', '100000',         // Kleinere Probe
        '-i', streamUrl,
        '-t', '1',                      // 1 Sekunde Test
        '-f', 'null',
        '-'
      ]);

      let success = false;
      let error = '';

      ffmpegProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('FFmpeg test output:', output);
        
        // Erfolgsindikatoren für BambuLab Stream
        if (output.includes('frame=') || 
            output.includes('Stream mapping:') || 
            output.includes('Opening') ||
            output.includes('Video:')) {
          success = true;
          cleanup();
          resolve(true);
        }
        error += output;
      });

      ffmpegProcess.on('close', (code) => {
        console.log('FFmpeg process closed with code:', code);
        console.log('Accumulated error:', error);
        cleanup();
        // Code 1 ist OK bei SSL-Warnungen
        resolve(success || code === 0 || code === 1);
      });

      // Längerer Timeout für langsame Verbindungen
      timeoutId = setTimeout(() => {
        console.log('RTSP test timeout');
        cleanup();
        resolve(success);
      }, 8000);  // 8 Sekunden Timeout
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

    // Teste die Verbindung nur für echte Drucker
    if (!cleanPrinterData.isMockPrinter) {
      console.log('Testing connection for real printer...');
      const isConnectable = await testRTSPConnection(cleanPrinterData.streamUrl);
      if (!isConnectable) {
        throw new Error('Could not connect to printer stream. Please check if LAN Mode is enabled and the Access Code is correct.');
      }
    }

    // Stream starten
    const streamProcess = await initStream(cleanPrinterData);
    
    // Nur die sauberen Daten für die Antwort
    const responseData = { ...cleanPrinterData };
    delete responseData.process;
    
    // Intern mit Prozess speichern
    const storageData = { ...cleanPrinterData };
    if (streamProcess) {
      storageData.process = {
        pid: streamProcess.pid
      };
    }
    
    printers.set(cleanPrinterData.id, storageData);
    
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