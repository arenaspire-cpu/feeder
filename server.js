const express = require("express");
const app = express();
const cors = require("cors");

const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(cors())
// In-memory feeder store
const feeders = {};

/*
feeders[device_id] = {
  token,
  online,
  lastSeen,
  lastFeed,
  queued
}
*/

// ================= APP / FLUTTERFLOW =================
app.post("/api/feed", (req, res) => {
  const device_id = req.body?.device_id;

  if (!device_id) {
    return res.status(400).json({
      ok: false,
      error: "device_id required"
    });
  }

  // Auto-create feeder if not exists
  if (!feeders[device_id]) {
    feeders[device_id] = {
      token: "SECRET123",
      online: false,
      lastSeen: null,
      lastFeed: null,
      queued: false
    };
  }

  feeders[device_id].queued = true;

  res.json({
    ok: true,
    status: "queued",
    device_id
  });
});

// List feeders (for FlutterFlow UI)
app.get("/api/feeders", (req, res) => {
  const list = Object.entries(feeders).map(([id, f]) => ({
    device_id: id,
    online: f.online,
    lastSeen: f.lastSeen,
    lastFeed: f.lastFeed
  }));

  res.json(list);
});

// ================= ESP =================
app.get("/command", (req, res) => {
  const { device_id, token } = req.query;

  if (!device_id || !token) {
    return res.json({ command: "NONE" });
  }

  // Auto-create feeder on first ESP contact
  if (!feeders[device_id]) {
    feeders[device_id] = {
      token,
      online: true,
      lastSeen: Date.now(),
      lastFeed: null,
      queued: false
    };
  }

  const feeder = feeders[device_id];

  // Token validation
  if (feeder.token !== token) {
    return res.json({ command: "NONE" });
  }

  // Update status
  feeder.online = true;
  feeder.lastSeen = Date.now();

  // Handle feed
  if (feeder.queued) {
    feeder.queued = false;
    feeder.lastFeed = Date.now();
    return res.json({ command: "FEED" });
  }

  res.json({ command: "NONE" });
});

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("Feeder backend running");
});

app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});


