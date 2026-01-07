const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('New connection established');

  ws.on('message', (data) => {
    // Relays message to everyone. Device filters for its ID.
    const message = data.toString();
    console.log("Relaying:", message);
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server is running...');
});
