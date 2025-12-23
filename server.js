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

/* FEED BUTTON */
app.post("/api/feed", (req, res) => {
  feeders.FEEDER_001.command = "FEED";
  res.json({ ok: true });
});

/* ESP POLL */
app.get("/command-http", (req, res) => {
  const f = feeders[req.query.device_id];
  if (!f || f.token !== req.query.token) {
    return res.json({ command: "NONE" });
  }
  const cmd = f.command;
  f.command = "NONE";
  res.json({ command: cmd });
});

/* IMAGE UPLOAD */
app.post("/upload/:id", (req, res) => {
  feeders[req.params.id].image = req.body;
  res.send("OK");
});

/* IMAGE VIEW */
app.get("/snapshot/:id", (req, res) => {
  const img = feeders[req.params.id].image;
  if (!img) return res.status(404).end();
  res.set("Content-Type", "image/jpeg");
  res.send(img);
});

app.listen(3000, () =>
  console.log("Backend running")
);
