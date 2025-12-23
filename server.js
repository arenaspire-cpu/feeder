const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.raw({ type: "image/jpeg", limit: "5mb" }));

const feeders = {
  FEEDER_001: {
    token: "SECRET123",
    command: "NONE",
    image: null,
    lastFeed: 0
  }
};

app.get("/", (_, res) => res.send("Backend OK"));

app.post("/api/upload", (req, res) => {
  const { device_id, token } = req.query;
  const f = feeders[device_id];
  if (!f || f.token !== token) return res.sendStatus(403);

  f.image = Buffer.from(req.body).toString("base64");
  res.send("OK");
});

app.get("/api/image/:id", (req, res) => {
  const f = feeders[req.params.id];
  if (!f || !f.image) return res.sendStatus(404);
  res.type("jpg").send(Buffer.from(f.image, "base64"));
});

app.post("/api/feed", express.json(), (req, res) => {
  const f = feeders[req.body.device_id];
  if (!f) return res.sendStatus(400);
  f.command = "FEED";
  res.json({ ok: true });
});

app.get("/command-http", (req, res) => {
  const f = feeders[req.query.device_id];
  if (!f || f.token !== req.query.token) return res.json({ command: "NONE" });
  const cmd = f.command;
  f.command = "NONE";
  res.json({ command: cmd });
});

app.listen(3000, () => console.log("Server running"));
