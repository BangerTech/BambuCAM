const { spawn } = require('child_process');
const WebSocket = require('ws');

const streams = new Map();

const startStream = async (printer) => {
  try {
    console.log(`Starting stream for printer ${printer.name} (${printer.streamUrl})`);
    
    // WebSocket Server für diesen Stream
    const wss = new WebSocket.Server({ port: printer.wsPort });
    console.log(`WebSocket server started on port ${printer.wsPort}`);

    // FFmpeg Prozess starten
    const ffmpeg = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-i', printer.streamUrl,
      '-c:v', 'mpeg1video',
      '-f', 'mpegts',
      '-b:v', '800k',
      'pipe:1'
    ]);

    // Error handling
    ffmpeg.on('error', (error) => {
      console.error(`FFmpeg error for printer ${printer.name}:`, error);
    });

    ffmpeg.stderr.on('data', (data) => {
      console.log(`FFmpeg output for ${printer.name}:`, data.toString());
    });

    // Stream zu allen verbundenen Clients senden
    wss.on('connection', (ws) => {
      console.log(`New client connected to stream for printer ${printer.name}`);
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for printer ${printer.name}:`, error);
      });

      ffmpeg.stdout.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
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