const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

// JSON for normal API
app.use(express.json({ limit: "1mb" }));

/*
  CONFIG
*/
const FEED_COOLDOWN_MS = 0; // set to 5*60*1000 later

/*
  IN-MEMORY STORE
*/
const feeders = {
  FEEDER_001: {
    token: "SECRET123",
    command: "NONE",
    lastSeen: Date.now(),
    lastFeed: 0,
    latestJpeg: null,     // Buffer
    latestJpegAt: 0,
    clipFrames: []        // [{buf, at}]
  }
};

/*
  HEALTH
*/
app.get("/", (req, res) => res.send("Feeder backend running"));

/*
  LIST FEEDERS
*/
app.get("/api/feeders", (req, res) => {
  const list = Object.keys(feeders).map(id => ({
    device_id: id,
    online: Date.now() - feeders[id].lastSeen < 20000,
    lastSeen: feeders[id].lastSeen,
    lastFeed: feeders[id].lastFeed,
    latestJpegAt: feeders[id].latestJpegAt
  }));
  res.json(list);
});

/*
  FEED REQUEST (UI BUTTON)
*/
app.post("/api/feed", (req, res) => {
  const { device_id } = req.body;
  const feeder = feeders[device_id];
  if (!device_id || !feeder) return res.status(400).json({ ok: false, error: "Invalid feeder" });

  const now = Date.now();
  if (now - feeder.lastFeed < FEED_COOLDOWN_MS) {
    return res.status(429).json({ ok: false, error: "Cooldown active" });
  }

  feeder.command = "FEED";
  feeder.lastFeed = now;

  console.log(new Date().toISOString(), "FEED queued for", device_id);
  res.json({ ok: true });
});

/*
  ESP POLLING
*/
app.get("/command-http", (req, res) => {
  const { device_id, token } = req.query;
  const feeder = feeders[device_id];

  if (!feeder || feeder.token !== token) {
    return res.json({ command: "NONE" });
  }

  feeder.lastSeen = Date.now();

  const cmd = feeder.command;
  feeder.command = "NONE";

  console.log(new Date().toISOString(), "Command delivered", device_id, cmd);
  res.json({ command: cmd });
});

/*
  RAW JPEG UPLOAD (LATEST IMAGE)
  IMPORTANT: this MUST use express.raw for image/jpeg
*/
app.post(
  "/api/upload-jpeg",
  express.raw({ type: "image/jpeg", limit: "5mb" }),
  (req, res) => {
    const { device_id, token } = req.query;
    const feeder = feeders[device_id];

    if (!feeder || feeder.token !== token) return res.status(401).send("NO");
    if (!req.body || !Buffer.isBuffer(req.body)) return res.status(400).send("NO_BODY");

    feeder.latestJpeg = req.body;
    feeder.latestJpegAt = Date.now();
    feeder.lastSeen = Date.now();

    res.json({ ok: true });
  }
);

/*
  RAW JPEG UPLOAD (CLIP FRAME)
*/
app.post(
  "/api/upload-frame",
  express.raw({ type: "image/jpeg", limit: "5mb" }),
  (req, res) => {
    const { device_id, token, clip_id, idx } = req.query;
    const feeder = feeders[device_id];

    if (!feeder || feeder.token !== token) return res.status(401).send("NO");
    if (!req.body || !Buffer.isBuffer(req.body)) return res.status(400).send("NO_BODY");

    // Keep only last ~60 frames (beta)
    feeder.clipFrames.push({ buf: req.body, at: Date.now(), clip_id, idx: Number(idx || 0) });
    if (feeder.clipFrames.length > 60) feeder.clipFrames.splice(0, feeder.clipFrames.length - 60);

    feeder.lastSeen = Date.now();
    res.json({ ok: true });
  }
);

/*
  SERVE LATEST IMAGE
*/
app.get("/api/latest.jpg", (req, res) => {
  const { device_id } = req.query;
  const feeder = feeders[device_id];
  if (!feeder || !feeder.latestJpeg) return res.status(404).send("No image yet");

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "no-store");
  res.send(feeder.latestJpeg);
});

/*
  SERVE “CLIP” AS MJPEG-LIKE STREAM (simple)
*/
app.get("/api/clip.mjpg", async (req, res) => {
  const { device_id } = req.query;
  const feeder = feeders[device_id];
  if (!feeder) return res.status(404).end();

  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=frame",
    "Cache-Control": "no-store",
    "Connection": "close",
    "Pragma": "no-cache",
  });

  // stream last N frames slowly
  const frames = feeder.clipFrames.slice(-30);
  for (const f of frames) {
    res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${f.buf.length}\r\n\r\n`);
    res.write(f.buf);
    res.write("\r\n");
    await new Promise(r => setTimeout(r, 120));
  }

  res.end();
});

/*
  SIMPLE UI
*/
app.get("/ui", (req, res) => {
  res.type("html").send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Feeder Beta UI</title>
  <style>
    body { font-family: Arial; padding: 16px; }
    .row { display:flex; gap:16px; flex-wrap:wrap; }
    .card { border:1px solid #ddd; border-radius:12px; padding:12px; }
    img { max-width: 360px; border-radius:12px; }
    button { padding:10px 14px; border-radius:10px; border:1px solid #333; cursor:pointer; }
    input { padding:8px; border-radius:8px; border:1px solid #ccc; }
  </style>
</head>
<body>
  <h2>Smart Feeder Beta UI</h2>

  <div class="card">
    <label>device_id:</label>
    <input id="device" value="FEEDER_001"/>
    <button onclick="feed()">Feed</button>
    <button onclick="refreshNow()">Refresh image</button>
  </div>

  <div class="row">
    <div class="card">
      <h3>Latest Image (auto refresh)</h3>
      <img id="latest" src="" alt="latest"/>
      <div id="status"></div>
    </div>

    <div class="card">
      <h3>Last Clip (burst playback)</h3>
      <img id="clip" src="" alt="clip"/>
      <div style="font-size:12px; opacity:0.8;">This plays the last uploaded burst frames.</div>
    </div>
  </div>

<script>
function deviceId(){ return document.getElementById("device").value.trim(); }

async function feed(){
  const r = await fetch("/api/feed", {
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({device_id: deviceId()})
  });
  const j = await r.json().catch(()=>({}));
  document.getElementById("status").textContent = "Feed response: " + JSON.stringify(j);
}

function refreshNow(){
  const d = deviceId();
  document.getElementById("latest").src = "/api/latest.jpg?device_id="+encodeURIComponent(d)+"&t="+Date.now();
  document.getElementById("clip").src   = "/api/clip.mjpg?device_id="+encodeURIComponent(d)+"&t="+Date.now();
}

setInterval(refreshNow, 1500);
refreshNow();
</script>
</body>
</html>
  `);
});

/*
  START
*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
