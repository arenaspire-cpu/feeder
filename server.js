const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

const FEEDERS = {
  FEEDER_001: {
    token: "SECRET123",
    command: "NONE",
    lastFeed: 0
  }
};

app.get("/", (req, res) => {
  res.send("Feeder backend running");
});

/******** FEED ********/
app.post("/api/feed", express.json(), (req, res) => {
  const { device_id } = req.body;
  const feeder = FEEDERS[device_id];
  if (!feeder) return res.status(400).end();

  feeder.command = "FEED";
  feeder.lastFeed = Date.now();
  res.json({ ok: true });
});

/******** COMMAND POLL ********/
app.get("/command-http", (req, res) => {
  const { device_id, token } = req.query;
  const feeder = FEEDERS[device_id];

  if (!feeder || feeder.token !== token) {
    return res.json({ command: "NONE" });
  }

  const cmd = feeder.command;
  feeder.command = "NONE";
  res.json({ command: cmd });
});

/******** IMAGE UPLOAD ********/
app.post("/api/upload", express.raw({ limit: "5mb", type: "image/jpeg" }), (req, res) => {
  const id = req.header("X-Device-ID");
  const token = req.header("X-Token");

  const feeder = FEEDERS[id];
  if (!feeder || feeder.token !== token) {
    return res.status(403).end();
  }

  fs.writeFileSync(`latest_${id}.jpg`, req.body);
  res.sendStatus(200);
});

/******** IMAGE SERVE ********/
app.get("/api/image/:id", (req, res) => {
  const file = `latest_${req.params.id}.jpg`;
  if (!fs.existsSync(file)) return res.status(404).end();
  res.sendFile(path.resolve(file));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server on", PORT));
