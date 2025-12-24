const express = require('express');
const app = express();

// Serve static files from public directory
app.use(express.static('public'));

// Handle all routes - serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/../public/index.html');
});

module.exports = app;

