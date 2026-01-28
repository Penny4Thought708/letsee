import express from "express";

const router = express.Router();

router.get("/get-ice", (req, res) => {
  res.json({
    iceServers: [
      {
        urls: [
          "turns:your-turn-domain:443?transport=tcp",
          "turn:your-turn-domain:3478?transport=udp"
        ],
        username: "yourTurnUsername",
        credential: "yourTurnPassword"
      },
      {
        urls: ["stun:stun.l.google.com:19302"]
      }
    ]
  });
});


export default router;
