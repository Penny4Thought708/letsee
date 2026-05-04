// /src/routes/auth/login.js
import express from "express";
import db from "../../db.js";
import bcrypt from "bcryptjs";

const router = express.Router();

/* -------------------------------------------------------
   POST /api/auth/login
------------------------------------------------------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({ success: false, error: "Missing credentials" });
    }

    const result = await db.query(
      "SELECT user_id, fullname, email, password, avatar FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (result.rowCount === 0) {
      return res.json({ success: false, error: "Email not found" });
    }

    const user = result.rows[0];

    // Fix PHP bcrypt prefix if needed
    let hash = user.password;
    if (hash.startsWith("$2y$")) {
      hash = "$2b$" + hash.substring(4);
    }

    const match = await bcrypt.compare(password, hash);
    if (!match) {
      return res.json({ success: false, error: "Password incorrect" });
    }

    // ⭐ OLD WORKING SESSION
    req.session.user_id = user.user_id;

    req.session.save(() => {
          return res.json({
        success: true,
        user: {
          user_id: user.user_id,
          fullname: user.fullname,
          email: user.email,
          bio: user.bio,
          website: user.website,
          twitter: user.twitter,
          instagram: user.instagram,
          show_online: user.show_online,
          allow_messages: user.allow_messages,
          avatar: user.avatar,
          banner: user.banner,
          theme: user.theme,
          username: user.username,
          pronouns: user.pronouns,
          status: user.status,
          location: user.location,
          github: user.github,
          linkedin: user.linkedin,
          youtube: user.youtube
        }
      });
    });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    res.json({ success: false, error: "Server error" });
  }
});

/* -------------------------------------------------------
   GET /api/auth/me
------------------------------------------------------- */
router.get("/me", async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.json({ success: false });
    }

    const result = await db.query(
      "SELECT user_id, fullname, email, avatar FROM users WHERE user_id = $1",
      [req.session.user_id]
    );

    if (result.rowCount === 0) {
      return res.json({ success: false });
    }

    return res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return res.json({ success: false });
  }
});

export default router;
