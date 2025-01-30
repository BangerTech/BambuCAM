const express = require('express');
const cors = require('cors');
const printersRouter = require('./routes/printers');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/printers', printersRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Server Error',
    details: err.message
  });
});

module.exports = app; 