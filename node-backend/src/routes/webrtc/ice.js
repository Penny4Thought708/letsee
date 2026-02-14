import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/get-ice", async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

    const auth = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64");

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const data = await response.json();

    if (!data.ice_servers) {
      console.error("[ICE] Twilio returned no ICE servers:", data);
      return res.json({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
      });
    }

    console.log("[ICE] Twilio ICE servers returned successfully");
    return res.json({ iceServers: data.ice_servers });
  } catch (err) {
    console.error("[ICE] Twilio error:", err);
    return res.json({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });
  }
});

export { router };
export default router;




