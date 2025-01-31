const { spawn } = require('child_process');
const WebSocket = require('ws');

const streams = new Map();

const startStream = async (printer) => {
  try {
    console.log('Starting stream with config:', {
      port: printer.wsPort,
      path: '/stream',
      host: '0.0.0.0'
    });
    
    const wss = new WebSocket.Server({ 
      port: printer.wsPort,
      path: '/stream',
      perMessageDeflate: false,
      host: '0.0.0.0'
    });
    
    wss.on('listening', () => {
      console.log(`WebSocket server is listening on port ${printer.wsPort}`);
    });

    wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    // FFmpeg Parameter für X1C/Mock Printer
    const ffmpegArgs = [
      '-rtsp_transport', 'tcp',
      '-rtsp_flags', 'prefer_tcp',
      '-i', printer.streamUrl,
      '-f', 'mpegts',
      '-codec:v', 'mpeg1video',
      '-b:v', '1000k',
      '-r', '30',
      '-tune', 'zerolatency',
      '-preset', 'ultrafast',
      '-bf', '0',
      'pipe:1'
    ];

    // FFmpeg Prozess starten
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    // Stream-Daten an alle verbundenen Clients senden
    ffmpeg.stdout.on('data', (data) => {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(data);
          } catch (e) {
            console.error('Error sending data:', e);
          }
        }
      });
    });

    // Verbindungs-Logging
    wss.on('connection', (ws) => {
      console.log(`Client connected to stream on port ${printer.wsPort}`);
      ws.on('close', () => console.log('Client disconnected from stream'));
      ws.on('error', (error) => console.error('WebSocket error:', error));
    });

    // FFmpeg Fehlerbehandlung
    ffmpeg.stderr.on('data', (data) => {
      console.log('FFmpeg:', data.toString());
    });

    // Speichere Stream in Map
    streams.set(printer.id, { ffmpeg, wss });

    return { ffmpeg, wss };
  } catch (error) {
    console.error('Stream start error:', error);
    throw error;
  }
};

const stopStream = async (printerId) => {
  try {
    const stream = streams.get(printerId);
    if (stream) {
      if (stream.ffmpeg) stream.ffmpeg.kill();
      if (stream.wss) {
        stream.wss.clients.forEach(client => client.close());
        stream.wss.close();
      }
      streams.delete(printerId);
    }
  } catch (error) {
    console.error(`Error stopping stream for printer ${printerId}:`, error);
    throw error;
  }
};

// Hilfsfunktion um freien Port zu finden
const getNextAvailablePort = (start, end) => {
  return new Promise((resolve, reject) => {
    const testPort = (port) => {
      if (port > end) {
        reject(new Error('No ports available'));
        return;
      }

      const server = require('net').createServer();
      server.listen(port, () => {
        server.once('close', () => {
          resolve(port);
        });
        server.close();
      });
      server.on('error', () => {
        testPort(port + 1);
      });
    };
    testPort(start);
  });
};

module.exports = {
  startStream,
  stopStream
}; 