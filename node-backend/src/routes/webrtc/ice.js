import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/get-ice", async (req, res) => {
  try {
    const body = JSON.stringify({ format: "urls" });

    const response = await fetch("https://global.xirsys.net/_turn/MyApp2", {
      method: "PUT",
      headers: {
        "Authorization":
          "Basic " +
           Buffer.from("bobbywatts:ed2ddae6-09b8-11f1-97f8-0242ac150006").toString("base64"),
        "Content-Type": "application/json",
        "Content-Length": body.length.toString(),
      },
      body,
    });

    const text = await response.text();
    let data = null;

    try {
      data = JSON.parse(text);
    } catch {
      console.error("[ICE] Xirsys non‑JSON response:", text);
    }

    if (!response.ok) {
      console.error("[ICE] Xirsys HTTP error:", response.status, text);
    }

    // If Xirsys says unauthorized or returns no iceServers, fall back
    let iceServers = Array.isArray(data?.v?.iceServers)
      ? data.v.iceServers
      : [];

    if (!response.ok || iceServers.length === 0) {
      console.warn("[ICE] Xirsys unavailable or empty, using fallback ICE set");

      // ✅ Fallback: public STUN + (optional) static TURN if you have one
      iceServers = [
        { urls: "stun:stun.l.google.com:19302" },
        // If you have a known-good TURN, add it here:
        // {
        //   urls: ["turns:us-turn3.xirsys.com:443?transport=tcp"],
        //   username: "....",
        //   credential: "....",
        // },
      ];
    }

    // Normalize urls to arrays
    iceServers = iceServers.map((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return { ...s, urls };
    });

    return res.json({ iceServers });
  } catch (err) {
    console.error("[ICE] Xirsys error:", err);

    // Hard fallback if everything explodes
    return res.json({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
      ],
    });
  }
});

export { router };
export default router;




