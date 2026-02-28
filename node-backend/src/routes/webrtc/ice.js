import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/get-ice", async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      console.error("[ICE] Missing Twilio credentials");
      return res.json({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
      });
    }

    const auth = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64");

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

    const data = await response.json();

    if (!data.ice_servers || !Array.isArray(data.ice_servers)) {
      console.error("[ICE] Twilio returned invalid ICE servers:", data);
      return res.json({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
      });
    }

    console.log("[ICE] Twilio ICE servers returned successfully");

    return res.json({
      iceServers: data.ice_servers
    });

  } catch (err) {
    console.error("[ICE] Twilio error:", err);
    return res.json({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
    });
  }
});

export default router;




