const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve the frontend files
app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
    console.log('Device connected (ESP32 or Browser)');

    ws.on('message', (data) => {
        const message = data.toString();
        console.log('Received:', message);

        // If the message is 'FEED' (from browser), tell ESP32 to 'ROTATE'
        if (message === 'FEED') {
            console.log('Broadcasting ROTATE command...');
            wss.clients.forEach((client) => {
                if (client.readyState === 1) {
                    client.send('ROTATE');
                }
            });
        }
    });

    ws.on('close', () => console.log('Client disconnected'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
