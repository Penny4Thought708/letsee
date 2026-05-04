import express from "express";
import db from "../../db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

router.get("/me", async (req, res) => {
  try {
    const token =
      req.cookies.token || req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.json({ success: false, error: "Not authenticated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await db.query(
      `SELECT
        user_id,
        fullname,
        email,
        bio,
        website,
        twitter,
        instagram,
        show_online,
        allow_messages,
        avatar,
        banner,
        theme,
        username,
        pronouns,
        status,
        location,
        github,
        linkedin,
        youtube
      FROM users
      WHERE user_id = $1`,
      [decoded.user_id]
    );

    if (!rows[0]) {
      return res.json({ success: false, error: "User not found" });
    }

    return res.json({ success: true, profile: rows[0] });

  } catch (err) {
    console.error("GET /me error:", err);
    return res.json({ success: false, error: err.message });
  }
});

export default router;


