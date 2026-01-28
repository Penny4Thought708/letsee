import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/get-ice", async (req, res) => {
  try {
    const body = JSON.stringify({ format: "urls" });

    const response = await fetch("https://global.xirsys.net/_turn/MyFirstApp", {
      method: "PUT",
      headers: {
        "Authorization":
          "Basic " +
          Buffer.from("TommyYatts:91585c4a-ef29-11f0-a612-0242ac150002").toString("base64"),
        "Content-Type": "application/json",
        "Content-Length": body.length,
      },
      body,
    });

    const data = await response.json();

    // Xirsys returns: { v: { iceServers: [...] } }
    const iceServers = data?.v?.iceServers;

    if (!iceServers) {
      console.error("[ICE] Invalid Xirsys response:", data);
      return res.status(500).json({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
    }

    res.json({ iceServers });
  } catch (err) {
    console.error("[ICE] Xirsys error:", err);
    res.json({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
  }
});

export default router;
