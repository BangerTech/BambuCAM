const os = require('os');
const net = require('net');
const dgram = require('dgram');

// Mock Printer Konfigurationen
const mockPrinters = [
  {
    // X1C Simulation - verhält sich exakt wie ein echter X1C
    name: 'BambuLab X1C (Mock)',
    ip: 'mock-printer-1',
    model: 'X1C',
    isMockPrinter: true,
    streamUrl: 'rtsp://bblp:12345678@mock-printer-1:8554/streaming/live/1',
    accessCode: '12345678',
    mqttPort: 8883,
    temperatures: {
      bed: 60,
      nozzle: 200
    },
    printTime: {
      remaining: 45 * 60,
      total: 60 * 60
    },
    status: 'printing',
    ams: true,  // Hat AMS
    chamber: true  // Hat Kammer-Temperatur
  },
  {
    // P1P Simulation - verhält sich exakt wie ein echter P1P
    name: 'BambuLab P1P (Mock)',
    ip: 'mock-printer-2',
    model: 'P1P',
    isMockPrinter: true,
    streamUrl: 'rtsp://bblp:12345678@mock-printer-2:8554/streaming/live/1',
    accessCode: '12345678',
    temperatures: {
      bed: 55,
      nozzle: 215
    },
    printTime: {
      remaining: 30 * 60,
      total: 90 * 60
    },
    status: 'idle',
    ams: false,  // Kein AMS
    chamber: false  // Keine Kammer
  },
  {
    // Standard Test-Drucker mit anderem Video-Pattern
    name: 'Test Webcam',
    ip: 'mock-printer-3',
    model: 'Generic',
    isMockPrinter: true,
    streamUrl: 'rtsp://bblp:12345678@mock-printer-3:8554/streaming/live/1',
    accessCode: '12345678',
    temperatures: {
      bed: 50,
      nozzle: 180
    },
    printTime: {
      remaining: 15 * 60,
      total: 20 * 60
    },
    status: 'printing'
  }
];

// Port-Scan für BambuLab Drucker
const checkPort = (host, port) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
};

// SSDP-Suche nach echten BambuLab Druckern
const searchBambuPrinters = () => {
  return new Promise((resolve) => {
    const found = new Set();
    let socket = null;
    
    try {
      socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      // BambuLab SSDP Discovery Message - Dies fehlte vorher
      const searchMessage = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
        'HOST: 239.255.255.250:1990\r\n' +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 3\r\n' +
        'ST: urn:bambulab-com:device:3dprinter:1\r\n' +
        '\r\n'
      );

      socket.on('error', (err) => {
        console.error('SSDP error:', err);
        if (socket) {
          socket.close();
          socket = null;
        }
      });

      socket.on('message', (msg, rinfo) => {
        const response = msg.toString();
        console.log('SSDP Response from:', rinfo.address, '\n', response);

        if (response.includes('bambulab') || response.includes('Bambu Lab')) {
          console.log('Found BambuLab printer at:', rinfo.address);
          found.add({
            name: `BambuLab Printer (${rinfo.address})`,
            ip: rinfo.address,
            model: 'Real Printer',
            isMockPrinter: false
          });
        }
      });

      socket.bind(() => {
        socket.setBroadcast(true);
        socket.setMulticastTTL(4);
        socket.addMembership('239.255.255.250');

        // Sende auf beiden BambuLab Ports
        [1990, 2021].forEach(port => {
          if (socket) {  // Check if socket still exists
            socket.send(searchMessage, 0, searchMessage.length, port, '239.255.255.250');
          }
        });
      });

      // Nach 5 Sekunden aufräumen
      setTimeout(() => {
        if (socket) {
          socket.close();
          socket = null;
        }
        resolve(Array.from(found));
      }, 5000);

    } catch (error) {
      console.error('SSDP setup error:', error);
      if (socket) {
        socket.close();
        socket = null;
      }
      resolve([]);  // Return empty array on error
    }
  });
};

// Hauptsuchfunktion
const scanNetwork = async () => {
  try {
    console.log('Starting network scan...');
    const printers = [...mockPrinters];
    console.log('Added mock printers:', printers);

    console.log('Starting SSDP discovery...');
    const realPrinters = await searchBambuPrinters();
    console.log('Found real printers:', realPrinters);
    
    printers.push(...realPrinters);
    console.log('Final printer list:', printers);
    return printers;
  } catch (error) {
    console.error('Network scan error:', error);
    return mockPrinters;
  }
};

module.exports = {
  scanNetwork
}; 