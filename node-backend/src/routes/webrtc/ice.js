import express from "express";

const router = express.Router();

router.get("/get-ice", (req, res) => {
  res.json({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });
});

export default router;
