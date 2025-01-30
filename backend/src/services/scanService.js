const os = require('os');
const net = require('net');
const dgram = require('dgram');

const SSDP_PORT = 1990;  // Bambu Lab verwendet Port 1990 und 2021
const SSDP_MULTICAST_ADDR = '239.255.255.250';
const SEARCH_TARGET = 'urn:bambulab-com:device:3dprinter:1';

const mockPrinters = [
  {
    name: 'Mock Printer 1',
    ip: 'mock-printer-1',
    model: 'X1C',
    isMockPrinter: true
  },
  {
    name: 'Mock Printer 2',
    ip: 'mock-printer-2',
    model: 'X1C',
    isMockPrinter: true
  },
  {
    name: 'Mock Printer 3',
    ip: 'mock-printer-3',
    model: 'X1C',
    isMockPrinter: true
  }
];

const checkPort = (host, port) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);  // 1 Sekunde Timeout

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

const searchBambuPrinters = () => {
  return new Promise((resolve) => {
    const found = new Set();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    // SSDP M-SEARCH Nachricht für BambuLab
    const searchMessage = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n' +
      'HOST: 239.255.255.250:1982\r\n' +  // BambuLab spezifischer Port
      'MAN: "ssdp:discover"\r\n' +
      'MX: 1\r\n' +
      'ST: urn:bambu-lab:service:3dprinter:1\r\n' + // BambuLab spezifischer Service Type
      'USER-AGENT: bambu-lab\r\n' + // BambuLab spezifischer User Agent
      '\r\n'
    );

    socket.on('error', (err) => {
      console.error('SSDP error:', err);
    });

    socket.on('message', (msg, rinfo) => {
      const response = msg.toString();
      console.log('SSDP Response from:', rinfo.address);
      console.log('Response:', response);

      // BambuLab spezifische Header prüfen
      if (response.includes('bambu-lab') || 
          response.includes('Bambu Lab') || 
          response.includes('X1C') || 
          response.includes('P1P')) {
        console.log('Found BambuLab printer at:', rinfo.address);
        found.add({
          name: `BambuLab Printer (${rinfo.address})`,
          ip: rinfo.address,
          model: response.includes('X1C') ? 'X1C' : 
                 response.includes('P1P') ? 'P1P' : 
                 'Auto-detected',
          isMockPrinter: false
        });
      }
    });

    socket.on('listening', () => {
      console.log('SSDP Discovery started...');
      try {
        // Sende auf verschiedenen Ports
        [1982, 1990, 2021].forEach(port => {
          socket.send(searchMessage, 0, searchMessage.length, port, '239.255.255.250');
          console.log(`Sent SSDP discovery on port ${port}`);
        });
      } catch (error) {
        console.error('Error sending SSDP:', error);
      }
    });

    // Bind to all interfaces
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.setMulticastTTL(4);
      socket.addMembership('239.255.255.250');
    });

    // Nach 3 Sekunden Suche beenden
    setTimeout(() => {
      try {
        socket.close();
      } catch (e) {
        console.error('Error closing socket:', e);
      }
      console.log('SSDP Discovery finished, found:', Array.from(found));
      resolve(Array.from(found));
    }, 3000);
  });
};

const scanNetwork = async () => {
  const printers = [];
  
  // Mock Printer für Tests
  printers.push(...mockPrinters);

  try {
    // SSDP-Suche
    console.log('Starting SSDP discovery...');
    const ssdpPrinters = await searchBambuPrinters();
    printers.push(...ssdpPrinters);

    // Fallback: Port-Scan wenn keine Drucker gefunden
    if (ssdpPrinters.length === 0) {
      console.log('No printers found via SSDP, trying port scan...');
      const networkInterfaces = os.networkInterfaces();
      const localIps = Object.values(networkInterfaces)
        .flat()
        .filter(iface => iface.family === 'IPv4' && !iface.internal)
        .map(iface => iface.address);

      for (const localIp of localIps) {
        const subnet = localIp.substring(0, localIp.lastIndexOf('.'));
        console.log(`Scanning subnet: ${subnet}`);

        const scanPromises = [];
        for (let i = 1; i < 255; i++) {
          const ip = `${subnet}.${i}`;
          scanPromises.push(
            checkPort(ip, 322)
              .then(isOpen => {
                if (isOpen) {
                  console.log(`Found potential printer at ${ip}`);
                  printers.push({
                    name: `BambuLab Printer (${ip})`,
                    ip: ip,
                    model: 'Auto-detected',
                    isMockPrinter: false
                  });
                }
              })
              .catch(error => console.debug(`Error scanning ${ip}:`, error))
          );
        }
        await Promise.all(scanPromises);
      }
    }
  } catch (error) {
    console.error('Network scan error:', error);
  }

  return printers;
};

module.exports = {
  scanNetwork
}; 