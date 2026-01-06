const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user or ESP32 connected:', socket.id);

    // When the "Feed" button is pressed on the website
    socket.on('feed_request', () => {
        console.log('Feed command received! Sending to ESP32...');
        // Broadcast to everyone (including the ESP32)
        io.emit('rotate_servo', { angle: 90 }); 
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
