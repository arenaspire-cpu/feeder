const express = require("express");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.raw({ limit: "2mb", type: "*/*" }));

const feeders = {
  FEEDER_001: {
    token: "SECRET123",
    command: "NONE",
    image: null,
    lastSeen: Date.now()
  }
};

app.post("/api/upload", (req, res) => {
  const id = req.headers["x-device-id"];
  const token = req.headers["x-token"];
  const feeder = feeders[id];

  if (!feeder || feeder.token !== token) {
    return res.sendStatus(401);
  }

  feeder.image = Buffer.from(req.body).toString("base64");
  feeder.lastSeen = Date.now();

  res.sendStatus(200);
});

app.get("/api/image/:id", (req, res) => {
  const feeder = feeders[req.params.id];
  if (!feeder || !feeder.image) return res.sendStatus(404);

  res.set("Content-Type", "image/jpeg");
  res.send(Buffer.from(feeder.image, "base64"));
});

app.post("/api/feed", (req, res) => {
  feeders.FEEDER_001.command = "FEED";
  res.json({ ok: true });
});

app.get("/command-http", (req, res) => {
  const feeder = feeders[req.query.device_id];
  if (!feeder || feeder.token !== req.query.token) {
    return res.json({ command: "NONE" });
  }
  const cmd = feeder.command;
  feeder.command = "NONE";
  res.json({ command: cmd });
});

app.listen(3000, () => console.log("Backend running"));
