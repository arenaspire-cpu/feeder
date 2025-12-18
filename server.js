const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/*
  IN-MEMORY FEEDER STORE
  (OK for MVP – later replace with DB)
*/
const feeders = {
  FEEDER_001: {
    token: "SECRET123",
    command: "NONE",
    lastSeen: Date.now()
  }
};

/*
  HEALTH CHECK
*/
app.get("/", (req, res) => {
  res.send("Feeder backend running");
});

/*
  GET FEEDERS (for app / web UI)
*/
app.get("/api/feeders", (req, res) => {
  const list = Object.keys(feeders).map(id => ({
    device_id: id,
    online: Date.now() - feeders[id].lastSeen < 15000,
    lastSeen: feeders[id].lastSeen
  }));

  res.json(list);
});

/*
  FEED REQUEST (from app / web)
*/
app.post("/api/feed", (req, res) => {
  const { device_id } = req.body;

  if (!device_id || !feeders[device_id]) {
    return res.status(400).json({ ok: false, error: "Invalid feeder" });
  }

  feeders[device_id].command = "FEED";     // 🔑 STORE COMMAND
  feeders[device_id].lastSeen = Date.now();

  console.log("FEED queued for", device_id);

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
  feeder.command = "NONE";                 // 🔑 RESET AFTER READ

  console.log("Command sent to", device_id, ":", cmd);

  res.json({ command: cmd });
});

/*
  START SERVER
*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
