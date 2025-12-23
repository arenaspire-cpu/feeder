const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/*
  CONFIG
*/
const FEED_COOLDOWN_MS = 0; // 5 minutes

/*
  IN-MEMORY FEEDER STORE
*/
const feeders = {
  FEEDER_001: {
    token: "SECRET123",
    command: "NONE",
    lastSeen: Date.now(),
    lastFeed: 0
  }
};

/*
  HEALTH CHECK
*/
app.get("/", (req, res) => {
  res.send("Feeder backend running");
});

/*
  GET FEEDERS (UI)
*/
app.get("/api/feeders", (req, res) => {
  const list = Object.keys(feeders).map(id => ({
    device_id: id,
    online: Date.now() - feeders[id].lastSeen < 20000,
    lastSeen: feeders[id].lastSeen,
    lastFeed: feeders[id].lastFeed
  }));

  res.json(list);
});

/*
  FEED REQUEST (UI / BUTTON)
*/
app.post("/api/feed", (req, res) => {
  const { device_id } = req.body;
  const feeder = feeders[device_id];

  if (!device_id || !feeder) {
    return res.status(400).json({ ok: false, error: "Invalid feeder" });
  }

  const now = Date.now();

  if (now - feeder.lastFeed < FEED_COOLDOWN_MS) {
    return res.status(429).json({
      ok: false,
      error: "Cooldown active"
    });
  }

  feeder.command = "FEED";
  feeder.lastFeed = now;

  console.log(
    new Date().toISOString(),
    "FEED queued for",
    device_id
  );

  res.json({ ok: true });
});

/*
  ESP POLLING ENDPOINT
*/
app.get("/command-http", (req, res) => {
  const { device_id, token } = req.query;
  const feeder = feeders[device_id];

  if (!feeder || feeder.token !== token) {
    return res.json({ command: "NONE" });
  }

  feeder.lastSeen = Date.now();

  const cmd = feeder.command;
  feeder.command = "NONE"; // reset after read

  console.log(
    new Date().toISOString(),
    "Command delivered to",
    device_id,
    cmd
  );

  res.json({ command: cmd });
});

/*
  START SERVER
*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

