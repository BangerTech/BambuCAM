const express = require('express');
const printerService = require('../services/printerService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const printers = await printerService.getAllPrinters();
    console.log('Sending printers:', printers);
    res.json(printers);
  } catch (error) {
    console.error('Error getting printers:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server Error', 
      details: error.message 
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, ipAddress, accessCode, streamUrl } = req.body;
    
    // Validiere die Eingaben
    if (!name || !ipAddress || !accessCode || !streamUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields',
        details: 'Name, IP, Access Code and Stream URL are required'
      });
    }

    // Teste die RTSP-Verbindung vor dem Hinzufügen
    console.log('Testing RTSP connection...');
    const isConnectable = await printerService.testRTSPConnection(streamUrl);
    
    if (!isConnectable) {
      return res.status(400).json({
        success: false,
        error: 'Connection failed',
        details: 'Could not connect to printer stream'
      });
    }

    const printer = await printerService.addPrinter({
      name,
      ipAddress,
      accessCode,
      streamUrl
    });

    res.json({ success: true, printer });
  } catch (error) {
    console.error('Error adding printer:', error);
    res.status(400).json({ 
      success: false, 
      error: 'Connection error',
      details: error.message
    });
  }
});

module.exports = router; 