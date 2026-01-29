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
    let iceServers = data?.v?.iceServers || [];

    // 🔥 Add guaranteed TURN relay on port 443
    const guaranteedRelay = {
      urls: "turn:global.xirsys.net:443?transport=tcp",
      username: "TommyYatts",
      credential: "91585c4a-ef29-11f0-a612-0242ac150002",
    };

    // Ensure relay is always included
    iceServers.push(guaranteedRelay);

    res.json({ iceServers });
  } catch (err) {
    console.error("[ICE] Xirsys error:", err);

    // Fallback: STUN + guaranteed TURN
    res.json({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:global.xirsys.net:443?transport=tcp",
          username: "TommyYatts",
          credential: "91585c4a-ef29-11f0-a612-0242ac150002",
        },
      ],
    });
  }
});

// ⭐ REQUIRED EXPORTS
export { router };
export default router;


