const os = require('os');
const net = require('net');
const dgram = require('dgram');

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

// SSDP-Suche nach BambuLab Druckern
const searchBambuPrinters = () => {
  return new Promise((resolve) => {
    const found = new Set();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    // BambuLab SSDP Discovery Message
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

      // BambuLab spezifische Antwort prüfen
      if (response.includes('bambulab') || response.includes('Bambu Lab')) {
        console.log('Found BambuLab printer at:', rinfo.address);
        found.add({
          name: `BambuLab Printer (${rinfo.address})`,
          ip: rinfo.address,
          model: 'Auto-detected',
          isMockPrinter: false
        });
      }
    });

    // Sende auf beiden BambuLab Ports
    const sendDiscovery = () => {
      [1990, 2021].forEach(port => {
        socket.send(searchMessage, 0, searchMessage.length, port, '239.255.255.250', (err) => {
          if (err) console.error(`Error sending to port ${port}:`, err);
          else console.log(`Sent discovery to port ${port}`);
        });
      });
    };

    socket.bind(() => {
      socket.setBroadcast(true);
      socket.setMulticastTTL(4);
      try {
        socket.addMembership('239.255.255.250');
        console.log('Started SSDP discovery');
        sendDiscovery();
        // Wiederhole die Suche alle 1.5 Sekunden
        const interval = setInterval(sendDiscovery, 1500);
        setTimeout(() => {
          clearInterval(interval);
          socket.close();
        }, 4500);  // Nach 4.5 Sekunden beenden
      } catch (e) {
        console.error('SSDP setup error:', e);
      }
    });

    // Nach 5 Sekunden Ergebnisse zurückgeben
    setTimeout(() => {
      try {
        socket.close();
      } catch (e) {
        console.error('Error closing socket:', e);
      }
      console.log('SSDP search finished, found:', Array.from(found));
      resolve(Array.from(found));
    }, 5000);
  });
};

// Hauptsuchfunktion
const scanNetwork = async () => {
  const printers = [];
  printers.push(...mockPrinters);

  try {
    // 1. SSDP-Suche
    console.log('Starting SSDP discovery...');
    const ssdpPrinters = await searchBambuPrinters();
    printers.push(...ssdpPrinters);

    // 2. Port-Scan als Fallback
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
            checkPort(ip, 322)  // BambuLab RTSP Port
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