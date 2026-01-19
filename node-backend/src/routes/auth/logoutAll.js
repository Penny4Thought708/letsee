import express from "express";
import db from "../../db.js";

const router = express.Router();

router.post("/logout-all", async (req, res) => {
  try {
    const token =
      req.cookies.token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) return res.json({ success: true });

    // Decode to get expiration
    const decoded = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );

    const expiresAt = new Date(decoded.exp * 1000);

    await db.query(
      "INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [token, expiresAt]
    );

    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none"
    });

    res.json({ success: true });
  } catch (err) {
    console.error("logout-all error:", err);
    res.json({ success: false });
  }
});

export default router;
