// node-backend/src/routes/webrtc/ice.js

import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/get-ice", async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

    // 1) Missing credentials → safe fallback
    if (!accountSid || !apiKeySid || !apiKeySecret) {
      console.error("[ICE] Missing Twilio credentials");
      return res.json({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
      });
    }

    const auth = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64");

    // 2) Twilio request
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "" // Twilio requires a body, even if empty
      }
    );

    if (!response.ok) {
      console.error("[ICE] Twilio HTTP error:", response.status);
      return res.json({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
      });
    }

   const data = await response.json();
   console.log("[ICE] Raw Twilio response:", JSON.stringify(data, null, 2));
   console.log("[ICE] Parsed ice_servers:", data?.ice_servers);


    // 3) Validate Twilio response
    let servers = Array.isArray(data?.ice_servers)
      ? data.ice_servers
      : [];

    // 4) Normalize + sanitize
    servers = servers
      .map((s) => {
        if (!s || !s.urls) return null;

        const urls = Array.isArray(s.urls)
          ? s.urls.filter((u) => typeof u === "string")
          : typeof s.urls === "string"
            ? [s.urls]
            : [];

        if (urls.length === 0) return null;

        return { ...s, urls };
      })
      .filter(Boolean);

    if (servers.length === 0) {
      console.warn("[ICE] Twilio returned no usable ICE servers");
      servers = [{ urls: ["stun:stun.l.google.com:19302"] }];
    }

    console.log("[ICE] Twilio ICE servers returned successfully");

    return res.json({ iceServers: servers });

  } catch (err) {
    console.error("[ICE] Twilio error:", err);
    return res.json({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
    });
  }
});

export default router;




