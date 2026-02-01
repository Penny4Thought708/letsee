// /node-backend/src/routes/users/search.js
import express from "express";
import db from "../../db.js";
import authMiddleware from "../../middleware/auth.js";

const router = express.Router();

router.get("/search", authMiddleware, async (req, res) => {
  try {
    const myUserId = req.session.user_id;
    const q = `%${req.query.query || ""}%`;

    const result = await db.query(
      `SELECT 
         user_id      AS contact_id,
         fullname     AS contact_name,
         email        AS contact_email,
         avatar       AS contact_avatar,
         phone        AS contact_phone,
         bio          AS contact_bio,
         website      AS contact_website,
         twitter      AS contact_twitter,
         instagram    AS contact_instagram,
         banner       AS contact_banner
       FROM users
       WHERE user_id != $1
         AND (fullname ILIKE $2 OR email ILIKE $2)
       ORDER BY fullname ASC
       LIMIT 20`,
      [myUserId, q]
    );

    res.json({
      success: true,
      users: result.rows
    });

  } catch (err) {
    console.error("[lookup] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

export default router;


