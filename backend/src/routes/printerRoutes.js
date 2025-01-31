const express = require('express');
const router = express.Router();
const printerService = require('../services/printerService');

// ... Bestehende Routes ...

// Status-Route hinzufügen
router.get('/:id/status', async (req, res) => {
  try {
    const printerId = parseInt(req.params.id);
    const status = await printerService.getPrinterStatus(printerId);
    res.json(status);
  } catch (error) {
    console.error('Error getting printer status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 