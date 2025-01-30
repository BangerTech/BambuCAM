const { spawn } = require('child_process');
const WebSocket = require('ws');

const streams = new Map();

const startStream = async (printer) => {
  try {
    console.log(`Starting stream for printer ${printer.name} (${printer.streamUrl})`);
    
    // WebSocket Server für diesen Stream
    const wss = new WebSocket.Server({ port: printer.wsPort });
    console.log(`WebSocket server started on port ${printer.wsPort}`);

    // Verbesserte FFmpeg Parameter für RTSPS
    const ffmpeg = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-rtsp_flags', 'prefer_tcp',
      '-allowed_media_types', 'video',
      '-analyzeduration', '100000',
      '-probesize', '100000',
      '-i', printer.streamUrl,
      '-c:v', 'mpeg1video',
      '-f', 'mpegts',
      '-b:v', '1000k',
      '-bf', '0',
      '-r', '30',
      '-muxdelay', '0.001',
      '-fflags', 'nobuffer',  // Reduziert Latenz
      '-flags', 'low_delay',  // Reduziert Latenz
      '-strict', 'experimental',
      '-tune', 'zerolatency', // Optimiert für Streaming
      'pipe:1'
    ]);

    // Verbesserte Fehlerbehandlung
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Error') || output.includes('Failed')) {
        console.error(`FFmpeg error for ${printer.name}:`, output);
      } else {
        console.debug(`FFmpeg output for ${printer.name}:`, output);
      }
    });

    // Verbesserte Client-Verbindung
    wss.on('connection', (ws) => {
      console.log(`New client connected to stream for printer ${printer.name}`);
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for printer ${printer.name}:`, error);
      });

      // Direkte Datenweiterleitung
      const streamHandler = (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(data);
          } catch (error) {
            console.error(`Error sending stream data for ${printer.name}:`, error);
          }
        }
      };

      ffmpeg.stdout.on('data', streamHandler);

      ws.on('close', () => {
        ffmpeg.stdout.removeListener('data', streamHandler);
      });
    });

    // Stream in Map speichern
    streams.set(printer.id, { ffmpeg, wss });
    
    return { ffmpeg, wss };
  } catch (error) {
    console.error(`Error starting stream for printer ${printer.name}:`, error);
    throw error;
  }
};

const stopStream = async (printerId) => {
  try {
    const stream = streams.get(printerId);
    if (stream) {
      if (stream.ffmpeg) stream.ffmpeg.kill();
      if (stream.wss) stream.wss.close();
      streams.delete(printerId);
    }
  } catch (error) {
    console.error(`Error stopping stream for printer ${printerId}:`, error);
    throw error;
  }
};

module.exports = {
  startStream,
  stopStream
}; 