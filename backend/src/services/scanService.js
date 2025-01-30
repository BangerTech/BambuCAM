const os = require('os');
const net = require('net');

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

const scanNetwork = async () => {
  const printers = [];
  
  // Mock Printer für Tests
  printers.push(...mockPrinters);

  try {
    const networkInterfaces = os.networkInterfaces();
    const localIps = Object.values(networkInterfaces)
      .flat()
      .filter(iface => iface.family === 'IPv4' && !iface.internal)
      .map(iface => iface.address);

    for (const localIp of localIps) {
      const subnet = localIp.substring(0, localIp.lastIndexOf('.'));
      console.log(`Scanning subnet: ${subnet}`);

      // Parallele Scans mit Promise.all
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
  } catch (error) {
    console.error('Network scan error:', error);
  }

  return printers;
};

module.exports = {
  scanNetwork
}; 