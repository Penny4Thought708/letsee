// /src/routes/auth/login.js
import express from "express";
import db from "../../db.js";
import bcrypt from "bcryptjs";

const router = express.Router();

/* -------------------------------------------------------
   POST /api/auth/login  — SAFE UPGRADED VERSION
------------------------------------------------------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({ success: false, error: "Missing credentials" });
    }

    // ⭐ FULL PROFILE SELECT
    const result = await db.query(
      `SELECT
        user_id,
        fullname,
        email,
        password,
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
      WHERE email = $1
      LIMIT 1`,
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

    // ⭐ REMOVE PASSWORD BEFORE SAVING SESSION
    delete user.password;

    // ⭐ STORE BOTH user_id AND FULL PROFILE
    req.session.user_id = user.user_id;
    req.session.user = user;

    req.session.save(() => {
      return res.json({
        success: true,
        profile: user
      });
    });

  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    res.json({ success: false, error: "Server error" });
  }
});

/* -------------------------------------------------------
   GET /api/auth/me — SAFE UPGRADED VERSION
------------------------------------------------------- */
router.get("/me", async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.json({ success: false });
    }

    const result = await db.query(
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
      [req.session.user_id]
    );

    if (result.rowCount === 0) {
      return res.json({ success: false });
    }

    return res.json({
      success: true,
      profile: result.rows[0]
    });

  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return res.json({ success: false });
  }
});

export default router;

