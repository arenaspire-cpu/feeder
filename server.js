const { WebSocketServer } = require('ws');
const server = require('http').createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        const payload = JSON.parse(data); // Expecting {action: "FEED", deviceId: "XYZ"}
        
        if (payload.action === 'FEED') {
            console.log(`Commanding Feeder: ${payload.deviceId}`);
            wss.clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(`ROTATE_${payload.deviceId}`);
                }
            });
        }
    });
});

server.listen(process.env.PORT || 3000);
