const express = require('express');
const cors = require('cors');
const net = require('net');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const app = express();
const activeStreams = new Map();
const printers = new Map(); // Speichere Drucker-Informationen

const MOCK_PRINTER_TIMEOUT = 45000; // 45 Sekunden für Mock-Printer
const STREAM_START_TIMEOUT = 30000; // 30 Sekunden für normale Printer

// Logger Funktion
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = {
        timestamp,
        level,
        message,
        data
    };
    console.log(JSON.stringify(logMessage));
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE']
}));

app.use(express.json());

// Funktion zum Testen der Port-Erreichbarkeit
function testPort(host, port) {
  return new Promise((resolve, reject) => {
    // Für Mock-Printer immer erfolgreich
    if (host === 'mock-printer') {
      // Generiere einen Port basierend auf der letzten Zahl der IP
      const mockId = port - 8554;  // z.B. 8554 -> 0, 8555 -> 1, etc.
      log('info', `Mock Printer ${mockId} Port Test erfolgreich`, { host, port });
      return resolve();
    }

    log('info', `Teste Port-Erreichbarkeit`, { host, port });
    const socket = new net.Socket();
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      log('info', `Verbindung erfolgreich hergestellt`, { host, port });
      socket.destroy();
      resolve();
    });
    
    socket.on('error', (err) => {
      log('error', `Fehler bei der Portverbindung`, { host, port, error: err.message });
      socket.destroy();
      reject(err);
    });
    
    socket.on('timeout', () => {
      log('error', `Zeitüberschreitung bei der Portverbindung`, { host, port });
      socket.destroy();
      reject(new Error('Zeitüberschreitung'));
    });
    
    socket.connect(port, host);
  });
}

function startFFmpeg(url) {
    return new Promise((resolve, reject) => {
        log('info', `Starte FFmpeg`, { url });
        const ffmpeg = spawn('ffmpeg', [
            '-i', url,
            '-c:v', 'mpeg1video',
            '-b:v', '200k',
            '-f', 'mpegts',
            'pipe:1'
        ]);

        let streamStarted = false;
        const timeoutId = setTimeout(() => {
            if (!streamStarted) {
                log('error', `FFmpeg Timeout`, { url });
                ffmpeg.kill();
                reject(new Error(`Stream-Start Timeout nach ${STREAM_START_TIMEOUT/1000} Sekunden`));
            }
        }, STREAM_START_TIMEOUT);

        let errorOutput = '';
        ffmpeg.stderr.on('data', (data) => {
            const output = data.toString();
            errorOutput += output;
            log('debug', `FFmpeg Output`, { output });

            if (output.includes('frame=')) {
                streamStarted = true;
                log('info', `Stream erfolgreich gestartet`, { url });
                clearTimeout(timeoutId);
                resolve(ffmpeg);
            }
        });

        ffmpeg.on('error', (err) => {
            log('error', `FFmpeg Fehler`, { error: err.message, errorOutput });
            clearTimeout(timeoutId);
            reject(err);
        });

        ffmpeg.on('exit', (code, signal) => {
            if (!streamStarted) {
                log('error', `FFmpeg unerwartet beendet`, { 
                    code, 
                    signal, 
                    errorOutput 
                });
                clearTimeout(timeoutId);
                reject(new Error(`FFmpeg beendet mit Code ${code} und Signal ${signal}`));
            }
        });
    });
}

async function testRTSPConnection(url) {
  return new Promise((resolve, reject) => {
    // Füge einen kleinen Delay hinzu, wenn es ein Mock-Printer ist
    const delay = url.includes('mock-printer') ? 1000 : 0;
    
    setTimeout(() => {
      log('info', `Teste RTSP-Verbindung`, { url });
      
      const isMockUrl = url.startsWith('rtsp://');
      const ffmpegArgs = [
        '-timeout', '5000000',  // 5 Sekunden Timeout
      ];

      if (!isMockUrl) {
        ffmpegArgs.push('-rtsp_flags', 'prefer_tcp');
        ffmpegArgs.push('-allowed_media_types', 'video');
      }

      ffmpegArgs.push(
        '-i', url,
        '-t', '1',  // Nur 1 Sekunde testen
        '-f', 'null',
        '-'
      );

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      let error = '';
      
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        error += output;
        log('debug', `RTSP Test Output`, { output });
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          log('info', `RTSP-Verbindung erfolgreich`);
          resolve();
        } else {
          log('error', `RTSP-Verbindung fehlgeschlagen`, { error });
          reject(new Error(`RTSP-Verbindung fehlgeschlagen: ${error}`));
        }
      });
    }, delay);
  });
}

class RTSPStream {
  constructor(options) {
    this.url = options.streamUrl;
    this.wsPort = options.wsPort;
    this.isMockPrinter = options.streamUrl.startsWith('rtsp://');  // Prüfen ob Mock oder echter Drucker
    this.wss = new WebSocket.Server({ port: this.wsPort });
    this.clients = new Set();
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
    });
  }

  start() {
    // Basis-Argumente für FFmpeg
    const args = [
      '-rtsp_transport', 'tcp',
      '-i', this.url,
      '-c:v', 'mpeg1video',
      '-f', 'mpegts',
      '-b:v', '800k'
    ];

    // Zusätzliche Optionen für echten Drucker (RTSPS)
    if (!this.isMockPrinter) {
      args.unshift(
        '-rtsp_flags', 'prefer_tcp',
        '-allowed_media_types', 'video'
      );
    }

    // Füge pipe:1 als letztes Argument hinzu
    args.push('pipe:1');

    log('info', 'Starte FFmpeg mit Argumenten', { args });
    
    this.ffmpeg = spawn('ffmpeg', args);
    
    this.ffmpeg.stdout.on('data', (data) => {
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    });

    return this.ffmpeg;
  }

  stop() {
    if (this.ffmpeg) {
      this.ffmpeg.kill();
    }
    this.clients.forEach(client => client.close());
    this.wss.close();
  }
}

// Funktion zum Starten eines Streams
function startStream(printer) {
  return new Promise((resolve, reject) => {
    log('info', `Starte Stream für Drucker`, { 
      printerId: printer.id, 
      name: printer.name, 
      rtspUrl: printer.rtspUrl,
      isMockPrinter: printer.ipAddress === 'mock-printer'
    });

    if (activeStreams.has(printer.id)) {
      log('info', `Stream existiert bereits`, { printerId: printer.id });
      return resolve(activeStreams.get(printer.id));
    }

    const wsPort = 9100 + activeStreams.size;
    const stream = new RTSPStream({
      streamUrl: printer.rtspUrl,
      wsPort: wsPort,
      isMockPrinter: printer.ipAddress === 'mock-printer'
    });

    let outputBuffer = '';
    let hasStarted = false;
    let hasError = false;

    const ffmpeg = stream.start();

    const timeout = setTimeout(() => {
      if (!hasStarted && !hasError) {
        log('error', `Stream Timeout`, { 
          printerId: printer.id,
          outputBuffer,
          isMockPrinter: printer.ipAddress === 'mock-printer'
        });
        stream.stop();
        reject(new Error(`Stream-Start Timeout nach ${printer.ipAddress === 'mock-printer' ? 
          MOCK_PRINTER_TIMEOUT/1000 : STREAM_START_TIMEOUT/1000} Sekunden`));
      }
    }, printer.ipAddress === 'mock-printer' ? MOCK_PRINTER_TIMEOUT : STREAM_START_TIMEOUT);

    ffmpeg.stderr.on('data', (data) => {
      if (hasStarted || hasError) return;
      
      const output = data.toString();
      outputBuffer += output;
      log('debug', `FFmpeg stderr Output`, { 
        printerId: printer.id, 
        output 
      });
      
      if (output.includes('frame=') || 
          output.includes('fps=') || 
          (outputBuffer.includes('Input #0') && 
           outputBuffer.includes('Stream mapping') && 
           outputBuffer.includes('Output #0'))) {
        hasStarted = true;
        log('info', `Stream erfolgreich initialisiert`, { 
          printerId: printer.id 
        });
        clearTimeout(timeout);
        stream.wsPort = wsPort;  // Fügen Sie den wsPort zum Stream-Objekt hinzu
        activeStreams.set(printer.id, stream);
        resolve(stream);
      }
    });

    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Connection refused') || 
          output.includes('Invalid data') ||
          output.includes('Error') ||
          output.includes('Could not') ||
          output.includes('Failed to') ||
          output.includes('Unable to') ||
          output.includes('Protocol not found')) {
        hasError = true;
        log('error', `Stream Verbindungsfehler`, { 
          printerId: printer.id,
          error: output 
        });
        clearTimeout(timeout);
        stream.stop();
        reject(new Error('Stream-Verbindungsfehler: ' + output));
      }
    });

    ffmpeg.on('error', (err) => {
      hasError = true;
      log('error', `Stream Fehler`, { 
        printerId: printer.id,
        error: err.message 
      });
      clearTimeout(timeout);
      stream.stop();
      reject(new Error(`Stream-Fehler: ${err.message}`));
    });

    ffmpeg.on('exit', (code, signal) => {
      if (!hasStarted && !hasError) {
        log('error', `FFmpeg unerwartet beendet`, { 
          printerId: printer.id,
          code,
          signal,
          outputBuffer
        });
        clearTimeout(timeout);
        stream.stop();
        reject(new Error(`FFmpeg beendet mit Code ${code} und Signal ${signal}`));
      }
    });
  });
}

// Funktion zum Hinzufügen eines Druckers
app.post('/printers', async (req, res) => {
  try {
    const { name, ipAddress } = req.body;
    const id = Date.now();
    let rtspUrl;

    if (ipAddress.startsWith('mock-printer-')) {
      // Mock-Printer verwenden Port 8554 im Container
      rtspUrl = `rtsp://bblp:12345678@${ipAddress}:8554/streaming/live/1`;
    } else {
      // Echte Drucker verwenden Port 322
      rtspUrl = `rtsps://bblp:${req.body.accessCode}@${ipAddress}:322/streaming/live/1`;
    }

    const printer = {
      id,
      name,
      ipAddress,
      rtspUrl
    };

    // Test RTSP connection before starting stream
    try {
      await testRTSPConnection(printer.rtspUrl);
    } catch (error) {
      log('error', `RTSP-Verbindungstest fehlgeschlagen`, { 
        url: printer.rtspUrl,
        error: error.message 
      });
      throw error;
    }

    try {
      const stream = await startStream(printer);
      
      // Speichere Drucker-Informationen
      printers.set(printer.id, printer);
      
      log('info', `Drucker erfolgreich hinzugefügt`, { 
        printerId: printer.id,
        wsPort: stream.wsPort 
      });

      res.json({
        success: true,
        printer: {
          ...printer,
          wsPort: stream.wsPort
        }
      });
    } catch (error) {
      if (activeStreams.has(printer.id)) {
        activeStreams.get(printer.id).stop();
        activeStreams.delete(printer.id);
      }
      throw error;
    }
  } catch (error) {
    log('error', `Fehler beim Hinzufügen des Druckers`, { 
      error: error.message 
    });
    res.status(400).json({
      success: false,
      error: 'Verbindungsfehler',
      details: error.message
    });
  }
});

// Endpunkt zum Abrufen aller Drucker
app.get('/printers', (req, res) => {
  const printerList = Array.from(printers.values()).map(printer => ({
    ...printer,
    wsPort: activeStreams.get(printer.id)?.wsPort
  }));
  log('info', `Drucker-Liste abgerufen`, { count: printerList.length });
  res.json(printerList);
});

// Endpunkt zum Löschen eines Druckers
app.delete('/printers/:id', (req, res) => {
  const id = parseInt(req.params.id);
  log('info', `Lösche Drucker`, { printerId: id });
  
  if (activeStreams.has(id)) {
    activeStreams.get(id).stop();
    activeStreams.delete(id);
    log('info', `Stream gestoppt`, { printerId: id });
  }
  printers.delete(id);
  res.json({ success: true });
});

// Health Check
app.get('/health', (req, res) => {
  log('debug', `Health check durchgeführt`);
  res.json({ status: 'healthy' });
});

const port = 4000;
app.listen(port, () => {
  log('info', `Backend gestartet`, { port });
}); 