const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[${new Date().toLocaleTimeString()}] New connection from: ${ip}`);

    ws.on('message', (data) => {
        const message = data.toString();
        console.log(`[Incoming] ${message}`);

        // Logic: If a browser sends 'FEED', we tell the ESP32 to 'ROTATE'
        if (message === 'FEED') {
            console.log('>>> Triggering Feed Mechanism...');
            
            let deviceFound = false;
            wss.clients.forEach((client) => {
                // We send the command to all other connected clients
                // In a simple setup, this ensures the ESP32 gets it
                if (client !== ws && client.readyState === 1) {
                    client.send('ROTATE');
                    deviceFound = true;
                }
            });

            if (!deviceFound) {
                console.log('Warning: No ESP32 device currently connected to server.');
            }
        }
        
        // Optional: ESP32 can send 'SUCCESS' back after rotating
        if (message === 'SUCCESS') {
            console.log('Mechanism confirmed: Cat has been fed.');
        }
    });

    ws.on('error', (error) => console.error('WebSocket Error:', error));

    ws.on('close', () => {
        console.log('Client disconnected.');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    =======================================
    Purrrr-System Backend Running
    Port: ${PORT}
    Local URL: http://localhost:${PORT}
    =======================================
    `);
});
