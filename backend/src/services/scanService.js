const os = require('os');
const net = require('net');
const dgram = require('dgram');

// Mock Printer klar gekennzeichnet
const mockPrinters = [
  {
    name: 'Mock Printer 1',
    ip: 'mock-printer-1',
    model: 'Mock X1C',
    isMockPrinter: true,
    streamUrl: 'rtsp://bblp:12345678@mock-printer-1:8554/streaming/live/1'
  },
  {
    name: 'Mock Printer 2',
    ip: 'mock-printer-2',
    model: 'Mock X1C',
    isMockPrinter: true,
    streamUrl: 'rtsp://bblp:12345678@mock-printer-2:8554/streaming/live/1'
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
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

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

    // Sende auf beiden BambuLab Ports
    [1990, 2021].forEach(port => {
      socket.send(searchMessage, 0, searchMessage.length, port, '239.255.255.250');
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      socket.setMulticastTTL(4);
      socket.addMembership('239.255.255.250');
    });

    setTimeout(() => {
      socket.close();
      resolve(Array.from(found));
    }, 5000);
  });
};

// Hauptsuchfunktion
const scanNetwork = async () => {
  try {
    const printers = [...mockPrinters];  // Start mit Mock Printern
    console.log('Added mock printers:', printers);

    // Suche nach echten Druckern
    console.log('Starting search for real printers...');
    const realPrinters = await searchBambuPrinters();
    console.log('Found real printers:', realPrinters);
    
    printers.push(...realPrinters);
    return printers;
  } catch (error) {
    console.error('Network scan error:', error);
    return mockPrinters;  // Fallback zu Mock Printern
  }
};

module.exports = {
  scanNetwork
}; 