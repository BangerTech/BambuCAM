const express = require('express');
const cors = require('cors');
const net = require('net');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const mqtt = require('mqtt');
const dgram = require('dgram');
const os = require('os');
const { scanNetwork } = require('./services/scanService');
const printerRoutes = require('./routes/printers');

const app = express();
const activeStreams = new Map();
const printers = new Map(); // Speichere Drucker-Informationen

const MOCK_PRINTER_TIMEOUT = 45000; // 45 Sekunden für Mock-Printer
const STREAM_START_TIMEOUT = 30000; // 30 Sekunden für normale Printer
const MAX_PRINTERS = 10;  // Oder eine andere sinnvolle Zahl

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
  origin: 'http://localhost:3000',  // Frontend URL
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
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
        
        // Basis-Argumente für FFmpeg
        const args = [];

        // Konfiguration basierend auf Printer-Typ
        const isMockPrinter = url.includes('mock-printer');
        if (isMockPrinter) {
            args.push('-rtsp_transport', 'tcp');
        } else {
            args.push(
                '-rtsp_transport', 'tcp',
                '-rtsp_flags', 'prefer_tcp',
                '-allowed_media_types', 'video'
            );
        }

        // Gemeinsame Argumente
        args.push(
            '-i', url,
            '-c:v', 'mpeg1video',
            '-f', 'mpegts',
            '-b:v', '800k',
            'pipe:1'
        );

        const ffmpeg = spawn('ffmpeg', args);
        
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
    const isMockUrl = url.includes('mock-printer');
    const ffmpegArgs = [
      '-timeout', '5000000',  // 5 Sekunden Timeout
    ];

    if (!isMockUrl) {
      // Für echte BambuLab Drucker
      ffmpegArgs.push(
        '-rtsp_transport', 'tcp',
        '-rtsp_flags', 'prefer_tcp',
        '-allowed_media_types', 'video'
      );
    }

    ffmpegArgs.push(
      '-i', url,
      '-t', '1',
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
  });
}

class RTSPStream {
  constructor(options) {
    this.url = options.streamUrl;
    this.wsPort = options.wsPort;
    this.isMockPrinter = options.streamUrl.includes('mock-printer');  // Geändert
    this.wss = new WebSocket.Server({ port: this.wsPort });
    this.clients = new Set();
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
    });
  }

  start() {
    // Basis-Argumente für FFmpeg
    const args = [];

    // Konfiguration basierend auf Printer-Typ
    if (this.isMockPrinter) {
      args.push('-rtsp_transport', 'tcp');
    } else {
      // Für echte BambuLab Drucker
      args.push(
        '-rtsp_transport', 'tcp',
        '-rtsp_flags', 'prefer_tcp',
        '-allowed_media_types', 'video'
      );
    }

    // Gemeinsame Argumente
    args.push(
      '-i', this.url,
      '-c:v', 'mpeg1video',
      '-f', 'mpegts',
      '-b:v', '800k',
      'pipe:1'
    );

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
      streamUrl: printer.streamUrl,  // Wichtig!
      isMockPrinter: printer.ipAddress.includes('mock-printer')
    });

    if (activeStreams.has(printer.id)) {
      log('info', `Stream existiert bereits`, { printerId: printer.id });
      return resolve(activeStreams.get(printer.id));
    }

    const stream = new RTSPStream({
      streamUrl: printer.streamUrl,  // Hier war der Fehler
      wsPort: printer.wsPort,
      isMockPrinter: printer.ipAddress.includes('mock-printer')
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
        stream.wsPort = printer.wsPort;  // Fügen Sie den wsPort zum Stream-Objekt hinzu
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

// Funktion zum Finden des nächsten freien Ports
function findNextFreePort() {
  const usedPorts = Array.from(printers.values()).map(p => p.wsPort);
  let port = 9100;
  while (usedPorts.includes(port)) {
    port++;
  }
  return port;
}

// Funktion zum Hinzufügen eines Druckers
app.post('/printers', async (req, res) => {
  console.log('Received printer add request:', {
    ...req.body,
    accessCode: '***' // Verstecke den Access Code
  });
  
  try {
    if (printers.size >= MAX_PRINTERS) {
      throw new Error(`Maximale Anzahl von ${MAX_PRINTERS} Druckern erreicht`);
    }
    const { name, ipAddress, streamUrl, accessCode } = req.body;
    const id = Date.now();
    const wsPort = findNextFreePort();  // Dynamischer Port

    const printer = {
      id,
      name,
      ipAddress,
      streamUrl,
      wsPort,    // Verwende den gefundenen Port
      accessCode
    };

    // Test RTSP connection before starting stream
    try {
      log('info', `Teste RTSP-Verbindung`, { url: printer.streamUrl });
      await testRTSPConnection(printer.streamUrl);
    } catch (error) {
      log('error', `RTSP-Verbindungstest fehlgeschlagen`, { 
        url: printer.streamUrl,
        error: error.message 
      });
      throw error;
    }

    if (printer.ipAddress.includes('mock-printer')) {
      printer.mqtt = new MockMQTTService({
        name: printer.name,
        id: printer.id
      });
    } else {
      printer.mqtt = new BambuLabPrinter({
        ip: printer.ipAddress,
        accessCode: printer.accessCode,
        name: printer.name
      });
      printer.mqtt.connect();
    }

    try {
      const stream = await startStream(printer);
      printers.set(printer.id, printer);
      
      log('info', `Drucker erfolgreich hinzugefügt`, { 
        printerId: printer.id,
        wsPort: wsPort
      });

      res.json({
        success: true,
        printer: {
          ...printer,
          wsPort: wsPort
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

// Drucker-Liste abrufen
app.get('/printers', (req, res) => {
  try {
    const printerList = Array.from(printers.values()).map(printer => {
      log('debug', 'Drucker-Details', printer);
      return {
        id: printer.id,
        name: printer.name,
        streamUrl: printer.streamUrl,
        isMockPrinter: printer.ipAddress.includes('mock-printer')
      };
    });
    
    log('info', `Drucker-Liste abgerufen`, { 
      count: printerList.length,
      printers: printerList 
    });
    res.json(printerList);
  } catch (error) {
    log('error', `Fehler beim Abrufen der Drucker-Liste`, { error: error.message });
    res.status(500).json({ error: error.message });
  }
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
  res.json({ status: 'ok' });
});

class BambuLabPrinter {
  constructor(options) {
    this.ip = options.ip;
    this.accessCode = options.accessCode;
    this.name = options.name;
    this.client = null;
    this.data = {
      temperatures: {
        bed: 0,
        nozzle: 0
      },
      printTime: {
        remaining: 0,
        total: 0
      },
      status: 'offline'
    };
  }

  connect() {
    const url = `mqtt://${this.ip}:1883`;
    this.client = mqtt.connect(url, {
      username: 'bblp',
      password: this.accessCode
    });

    this.client.on('connect', () => {
      console.log(`Connected to ${this.name}`);
      this.client.subscribe('bambu/+/sensors/#');
    });

    this.client.on('message', (topic, message) => {
      const data = JSON.parse(message.toString());
      if (topic.includes('temperature')) {
        this.data.temperatures = {
          bed: data.bed,
          nozzle: data.nozzle
        };
      } else if (topic.includes('print_stats')) {
        this.data.printTime = {
          remaining: data.time_remaining,
          total: data.total_time
        };
      }
    });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
    }
  }

  getData() {
    return this.data;
  }
}

class MockMQTTService {
  constructor(options) {
    // Statt des ganzen Printers nur die benötigten Infos speichern
    this.name = options.name;
    this.id = options.id;
    
    this.data = {
      temperatures: {
        bed: 60,
        nozzle: 200
      },
      printTime: {
        remaining: 45 * 60,
        total: 60 * 60
      },
      status: 'printing'
    };

    // Simuliere Temperaturänderungen
    setInterval(() => {
      this.data.temperatures.bed += (Math.random() - 0.5) * 2;
      this.data.temperatures.nozzle += (Math.random() - 0.5) * 2;
      
      if (this.data.printTime.remaining > 0) {
        this.data.printTime.remaining -= 5;
      }
    }, 5000);
  }

  getData() {
    return this.data;
  }
}

// Drucker-Routen
app.use('/printers', printerRoutes);

// Scan-Route
app.get('/scan', async (req, res) => {
  try {
    const printers = await scanNetwork();
    res.json(printers);
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Scan failed' });
  }
});

const port = 4000;
app.listen(port, '0.0.0.0', () => {  // Wichtig: '0.0.0.0' statt localhost
  console.log(`Server running on port ${port}`);
}); 