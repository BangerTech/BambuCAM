const express = require('express');
const cors = require('cors');
const net = require('net');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const mqtt = require('mqtt');
const dgram = require('dgram');
const os = require('os');
const { scanNetwork } = require('./src/services/scanService');
const printerRoutes = require('./src/routes/printers');

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

// CORS für Frontend-Zugriff
app.use(cors({
  origin: '*',  // Erlaubt alle Origins
  methods: ['GET', 'POST', 'DELETE']
}));

app.use(express.json());

// Debug-Log für CORS
app.use((req, res, next) => {
  console.log('Request from:', req.headers.origin);
  next();
});

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
    this.streamUrl = options.streamUrl;
    this.wsPort = options.wsPort;
    this.isMockPrinter = options.isMockPrinter;
    this.clients = new Set();
    this.isStreaming = false;
    
    this.wss = new WebSocket.Server({ 
      port: this.wsPort,
      path: '/stream'
    });
    
    this.wss.on('connection', (ws) => {
      console.log(`Client connected to stream on port ${this.wsPort}`);
      this.clients.add(ws);
      
      // Wenn es der erste Client ist, starte den Stream
      if (this.clients.size === 1 && !this.isStreaming) {
        this.start();
      }

      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
        
        // Wenn keine Clients mehr da sind, stoppe den Stream
        if (this.clients.size === 0) {
          this.stop();
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }

  start() {
    if (this.isStreaming) return;
    
    console.log(`Starting stream on port ${this.wsPort}`);
    this.isStreaming = true;

    const args = [
      '-rtsp_transport', 'tcp',
      '-i', this.streamUrl,
      '-f', 'mpegts',
      '-codec:v', 'mpeg1video',
      '-b:v', '1000k',
      '-bf', '0',
      'pipe:1'
    ];

    this.ffmpeg = spawn('ffmpeg', args);

    this.ffmpeg.stdout.on('data', (data) => {
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(data);
          } catch (e) {
            console.error('Error sending data:', e);
            this.clients.delete(client);
          }
        }
      });
    });

    this.ffmpeg.stderr.on('data', (data) => {
      console.log(`FFmpeg stderr: ${data}`);
    });

    this.ffmpeg.on('close', (code) => {
      console.log(`FFmpeg process closed with code ${code}`);
      this.isStreaming = false;
    });

    return this.ffmpeg;
  }

  stop() {
    if (!this.isStreaming) return;
    
    console.log(`Stopping stream on port ${this.wsPort}`);
    this.isStreaming = false;
    
    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGTERM');
    }
    
    this.clients.forEach(client => {
      try {
        client.close();
      } catch (e) {
        console.error('Error closing client:', e);
      }
    });
    this.clients.clear();
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
        id: printer.id,
        model: 'Test'
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

// Funktion zum Wiederherstellen der Streams beim Server-Start
async function restoreStreams() {
  try {
    for (const [id, printer] of printers.entries()) {
      if (!activeStreams.has(id)) {
        try {
          console.log(`Stelle Stream wieder her für Drucker ${printer.name}`);
          const stream = await startStream(printer);
          activeStreams.set(id, stream);
        } catch (error) {
          console.error(`Fehler beim Wiederherstellen des Streams für ${printer.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Fehler beim Wiederherstellen der Streams:', error);
  }
}

// Drucker-Liste abrufen
app.get('/printers', async (req, res) => {
  try {
    // Stelle sicher, dass alle Streams aktiv sind
    await restoreStreams();
    
    const printerList = Array.from(printers.values()).map(printer => {
      const stream = activeStreams.get(printer.id);
      return {
        id: printer.id,
        name: printer.name,
        streamUrl: printer.streamUrl,
        wsPort: stream?.wsPort,
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

// Status-Route hinzufügen (direkt nach den anderen Routes)
app.get('/printers/:id/status', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const printer = printers.get(id);
    
    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    // Mock-Status für Test-Drucker
    const status = {
      temperatures: {
        bed: 60 + Math.random() * 2,
        nozzle: 200 + Math.random() * 5
      },
      printTime: {
        remaining: 45 * 60,
        total: 60 * 60
      },
      status: 'printing',
      progress: 75,
      material: 'PLA',
      speed: 100,
      fan_speed: 100,
      layer: 75,
      total_layers: 100
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting printer status:', error);
    res.status(500).json({ error: error.message });
  }
});

class BambuLabPrinter {
  constructor(options) {
    this.ip = options.ip;
    this.accessCode = options.accessCode;
    this.name = options.name;
    this.mqttClient = null;
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
    if (!this.ip || !this.accessCode) return;

    this.mqttClient = mqtt.connect(`mqtt://${this.ip}:8883`, {
      username: 'bblp',
      password: this.accessCode,
      rejectUnauthorized: false
    });

    this.mqttClient.on('connect', () => {
      console.log(`MQTT Connected to ${this.name}`);
      this.mqttClient.subscribe('device/+/report');
    });

    this.mqttClient.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.temperature) {
          this.data.temperatures = {
            bed: data.temperature.bed,
            nozzle: data.temperature.nozzle
          };
        }
        if (data.print) {
          this.data.printTime = {
            remaining: data.print.remaining_time,
            total: data.print.total_time
          };
        }
      } catch (error) {
        console.error('MQTT parse error:', error);
      }
    });
  }

  disconnect() {
    if (this.mqttClient) {
      this.mqttClient.end();
    }
  }

  getData() {
    return this.data;
  }
}

class MockMQTTService {
  constructor(options) {
    this.name = options.name;
    this.id = options.id;
    this.model = options.model;
    
    // Basis-Konfiguration basierend auf Drucker-Modell
    const configs = {
      'X1C': {
        tempRange: { bed: [55, 65], nozzle: [195, 215] },
        hasAMS: true,
        hasChamber: true,
        chamberTemp: 35
      },
      'P1P': {
        tempRange: { bed: [50, 60], nozzle: [190, 210] },
        hasAMS: false,
        hasChamber: false
      },
      'Test': {
        tempRange: { bed: [20, 30], nozzle: [20, 30] },
        hasAMS: false,
        hasChamber: false
      }
    };

    const config = configs[this.model] || configs.Test;
    
    // Realistische Startwerte
    this.data = {
      temperatures: {
        bed: Math.random() * (config.tempRange.bed[1] - config.tempRange.bed[0]) + config.tempRange.bed[0],
        nozzle: Math.random() * (config.tempRange.nozzle[1] - config.tempRange.nozzle[0]) + config.tempRange.nozzle[0]
      },
      printTime: {
        remaining: this.model === 'Test' ? 0 : 45 * 60,
        total: this.model === 'Test' ? 0 : 60 * 60
      },
      status: this.model === 'Test' ? 'offline' : 'printing',
      progress: 0,
      material: 'PLA',
      speed: 100,
      fan_speed: 100,
      layer: 1,
      total_layers: 100,
      ams: config.hasAMS,
      chamber_temp: config.hasChamber ? config.chamberTemp : null
    };

    // Simuliere realistische Temperaturänderungen
    if (this.model !== 'Test') {
      setInterval(() => {
        // Kleine zufällige Schwankungen
        this.data.temperatures.bed += (Math.random() - 0.5) * 0.5;
        this.data.temperatures.nozzle += (Math.random() - 0.5) * 1.0;
        if (config.hasChamber) {
          this.data.chamber_temp += (Math.random() - 0.5) * 0.2;
        }
        
        // Druckfortschritt
        if (this.data.status === 'printing') {
          if (this.data.printTime.remaining > 0) {
            this.data.printTime.remaining -= 1;
            this.data.progress = (this.data.printTime.total - this.data.printTime.remaining) / this.data.printTime.total * 100;
            this.data.layer = Math.floor(this.data.progress / 100 * this.data.total_layers);
          } else {
            this.data.status = 'completed';
          }
        }
      }, 1000);
    }
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
    console.log('Starting network scan...');
    const printers = await scanNetwork();
    console.log('Scan complete, found printers:', printers);
    res.json(printers);
  } catch (error) {
    console.error('Scan error:', error);
    // Sende eine ordentliche Fehlerantwort
    res.status(500).json({ 
      error: 'Scan failed', 
      details: error.message,
      mockPrinters: mockPrinters // Fallback zu Mock-Printern
    });
  }
});

const port = 4000;
app.listen(port, async () => {
  log('info', `Backend gestartet`, { port });
  await restoreStreams();
}); 