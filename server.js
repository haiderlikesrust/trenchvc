const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static('public'));

// WebSocket server for signaling
const wss = new WebSocket.Server({ server });

const clients = new Map(); // Store all connected clients

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  
  console.log(`Client connected: ${clientId} (Total: ${clients.size})`);
  
  // Send client their own ID
  ws.send(JSON.stringify({
    type: 'your-id',
    id: clientId
  }));
  
  // Send list of existing clients to the new client
  const existingClients = Array.from(clients.keys()).filter(id => id !== clientId);
  if (existingClients.length > 0) {
    ws.send(JSON.stringify({
      type: 'existing-clients',
      clients: existingClients
    }));
  }
  
  // Broadcast new client to all other clients
  broadcastToOthers(clientId, {
    type: 'new-client',
    id: clientId
  });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Relay signaling messages to other clients
      if (data.type === 'offer' || data.type === 'answer' || data.type === 'ice-candidate') {
        const targetClient = clients.get(data.target);
        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
          targetClient.send(JSON.stringify({
            ...data,
            from: clientId
          }));
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId} (Total: ${clients.size})`);
    
    // Notify all other clients
    broadcastToOthers(clientId, {
      type: 'client-left',
      id: clientId
    });
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
});

function broadcastToOthers(senderId, message) {
  clients.forEach((ws, id) => {
    if (id !== senderId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Trench VC server running on http://localhost:${PORT}`);
  console.log(`🎤 Ready for the memes!`);
});

