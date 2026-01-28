import express from "express";

const router = express.Router();

router.get("/get-ice", (req, res) => {
  res.json({
    iceServers: [
      {
        urls: [
          "turns:global.xirsys.net:443?transport=tcp",
          "turn:global.xirsys.net:3478?transport=udp"
        ],
        username: "TommyYatts",
        credential: "91585c4a-ef29-11f0-a612-0242ac150002"
      },
      {
        urls: ["stun:stun.l.google.com:19302"]
      }
    ]
  });
});



export default router;
