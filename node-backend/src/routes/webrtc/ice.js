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
        "Content-Type": "application/json"
      },
      body
    });

    const data = await response.json();

    // Xirsys returns: { v: { iceServers: [...] } }
    let iceServers = Array.isArray(data?.v?.iceServers)
      ? data.v.iceServers
      : [];

    // ⭐ Guaranteed TURN relay on 443/tcp (best for mobile)
    const guaranteedRelay = {
      urls: ["turn:global.xirsys.net:443?transport=tcp"],
      username: "TommyYatts",
      credential: "91585c4a-ef29-11f0-a612-0242ac150002"
    };

    // Avoid duplicates
    const hasRelay443 = iceServers.some(s =>
      (Array.isArray(s.urls) ? s.urls : [s.urls]).some(u =>
        u.includes("global.xirsys.net:443")
      )
    );

    if (!hasRelay443) {
      iceServers.push(guaranteedRelay);
    }

    return res.json({ iceServers });

  } catch (err) {
    console.error("[ICE] Xirsys error:", err);

    // ⭐ Clean fallback: STUN + TURN (TCP 443)
    return res.json({
      iceServers: [
        { urls: ["stun:stun.l.google.com:19302"] },
        {
          urls: [
            "turns:us-turn3.xirsys.com:443?transport=tcp",
            "turns:us-turn3.xirsys.com:5349?transport=tcp"
          ],
          username:
            "pNNsSw9RUFU1xAmcGCS_jLnWqdxLgtmfu842JQSyJCHTIgqCXERA2MZWWQES9H9VAAAAAGl7xz1Ub21teVlhdHRz",
          credential: "a4e8a85e-fd53-11f0-b4fa-0242ac140004"
        }
      ]
    });
  }
});

export { router };
export default router;



