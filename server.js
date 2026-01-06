const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// IN-MEMORY STORAGE (Auto-populates when a new feeder connects)
let feeders = {};

/*
  1. AUTO-REGISTRATION & COMMAND POLLING
  The ESP32 calls this every 1-2 seconds.
*/
app.get("/api/poll", (req, res) => {
    const { device_id, token } = req.query;

    // AUTO-ADD: If feeder doesn't exist, create it automatically
    if (!feeders[device_id]) {
        console.log(`New Feeder Registered: ${device_id}`);
        feeders[device_id] = {
            token: token || "default_pass",
            command: "NONE",
            lastSeen: Date.now(),
            latestFrame: null
        };
    }

    const feeder = feeders[device_id];
    feeder.lastSeen = Date.now();

    // Send pending command and reset
    const cmd = feeder.command;
    feeder.command = "NONE";
    res.json({ command: cmd });
});

/*
  2. IMAGE UPLOAD (The "Push" for the stream)
  The ESP32 posts its camera frames here as fast as it can.
*/
app.post("/api/upload", express.raw({ type: "image/jpeg", limit: "2mb" }), (req, res) => {
    const { device_id } = req.query;
    if (feeders[device_id]) {
        feeders[device_id].latestFrame = req.body;
        feeders[device_id].lastSeen = Date.now();
        return res.sendStatus(200);
    }
    res.sendStatus(404);
});

/*
  3. PROXIED MJPEG STREAM
  This makes Render look like a real live camera to your phone.
*/
app.get("/api/stream", (req, res) => {
    const { device_id } = req.query;
    const feeder = feeders[device_id];

    if (!feeder) return res.status(404).send("Feeder not found");

    res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache'
    });

    // Send a new frame to the browser whenever we have one
    const streamInterval = setInterval(() => {
        if (feeder.latestFrame) {
            res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${feeder.latestFrame.length}\r\n\r\n`);
            res.write(feeder.latestFrame);
            res.write("\r\n");
        }
    }, 100); // 10 FPS approx

    req.on('close', () => clearInterval(streamInterval));
});

/*
  4. UI ACTION: FEED
*/
app.post("/api/feed", (req, res) => {
    const { device_id } = req.body;
    if (feeders[device_id]) {
        feeders[device_id].command = "FEED";
        return res.json({ success: true });
    }
    res.status(404).json({ error: "Feeder offline" });
});

/*
  5. PURRRR-STYLE UI
*/
app.get("/", (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Purrrr Cloud</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: sans-serif; background: #121212; color: white; text-align: center; }
            .feeder-card { background: #1e1e1e; margin: 20px auto; padding: 20px; max-width: 400px; border-radius: 20px; border: 1px solid #333; }
            img { width: 100%; border-radius: 15px; background: #000; min-height: 200px; }
            .btn { background: #ff4757; color: white; border: none; padding: 15px 30px; border-radius: 50px; font-size: 18px; cursor: pointer; margin-top: 15px; width: 100%; }
            .status { font-size: 12px; color: #777; margin-bottom: 10px; }
            .live-dot { color: #ff4757; animation: blink 1s infinite; }
            @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        </style>
    </head>
    <body>
        <h1>🐾 Purrrr Feeders</h1>
        <div id="app">Loading feeders...</div>

        <script>
            async function loadFeeders() {
                // In a real app, you'd fetch a list. For now, we'll just check the active one.
                const device_id = "FEEDER_001"; 
                document.getElementById('app').innerHTML = \`
                    <div class="feeder-card">
                        <div class="status"><span class="live-dot">●</span> LIVE FEED</div>
                        <img src="/api/stream?device_id=\${device_id}">
                        <h2>\${device_id}</h2>
                        <button class="btn" onclick="feed('\${device_id}')">Dispense Treat</button>
                    </div>
                \`;
            }

            async function feed(id) {
                await fetch('/api/feed', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ device_id: id })
                });
                alert("Feed command sent!");
            }
            loadFeeders();
        </script>
    </body>
    </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Purrrr Backend Active on Port ${PORT}`));
