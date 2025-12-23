const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

// IMPORTANT: RAW body for images
app.use("/upload-frame", express.raw({
  type: "application/octet-stream",
  limit: "5mb"
}));

/* ===== CONFIG ===== */
const FEED_COOLDOWN_MS = 0;

/* ===== FEEDERS ===== */
const feeders = {
  FEEDER_001: {
    token: "SECRET123",
    command: "NONE",
    lastFeed: 0,
    lastSeen: Date.now()
  }
};

/* ===== FEED COMMAND ===== */
app.get("/command-http", (req, res) => {
  const { device_id, token } = req.query;
  const feeder = feeders[device_id];

  if (!feeder || feeder.token !== token) {
    return res.json({ command: "NONE" });
  }

  feeder.lastSeen = Date.now();
  const cmd = feeder.command;
  feeder.command = "NONE";

  res.json({ command: cmd });
});

/* ===== FEED REQUEST ===== */
app.post("/api/feed", express.json(), (req, res) => {
  const { device_id } = req.body;
  const feeder = feeders[device_id];
  if (!feeder) return res.sendStatus(400);

  feeder.command = "FEED";
  feeder.lastFeed = Date.now();
  res.json({ ok: true });
});

/* ===== RECEIVE FRAME ===== */
app.post("/upload-frame", (req, res) => {
  const device = req.query.device_id;
  if (!device) return res.sendStatus(400);

  const dir = path.join(__dirname, "clips", device);
  fs.mkdirSync(dir, { recursive: true });

  const file = path.join(dir, `${Date.now()}.jpg`);
  fs.writeFileSync(file, req.body);

  res.sendStatus(200);
});

/* ===== LIST CLIPS ===== */
app.get("/clips/:device", (req, res) => {
  const dir = path.join(__dirname, "clips", req.params.device);
  if (!fs.existsSync(dir)) return res.json([]);

  const files = fs.readdirSync(dir).slice(-30);
  res.json(files);
});

app.use("/media", express.static("clips"));

app.listen(3000, () =>
  console.log("Backend running on 3000")
);
