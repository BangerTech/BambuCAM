const scanNetwork = async () => {
  const printers = [];
  
  // Mock Printer für Tests
  printers.push(...mockPrinters);

  try {
    // Netzwerk-Scan für echte BambuLab Drucker
    const networkInterfaces = os.networkInterfaces();
    const localIps = Object.values(networkInterfaces)
      .flat()
      .filter(iface => iface.family === 'IPv4' && !iface.internal)
      .map(iface => iface.address);

    for (const localIp of localIps) {
      const subnet = localIp.substring(0, localIp.lastIndexOf('.'));
      console.log(`Scanning subnet: ${subnet}`);

      // Scan Port 322 auf allen IPs im Subnetz
      for (let i = 1; i < 255; i++) {
        const ip = `${subnet}.${i}`;
        try {
          const isOpen = await checkPort(ip, 322);
          if (isOpen) {
            console.log(`Found potential printer at ${ip}`);
            printers.push({
              name: `BambuLab Printer (${ip})`,
              ip: ip,
              model: 'Auto-detected',
              isMockPrinter: false
            });
          }
        } catch (error) {
          console.debug(`Error scanning ${ip}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Network scan error:', error);
  }

  return printers;
}; 