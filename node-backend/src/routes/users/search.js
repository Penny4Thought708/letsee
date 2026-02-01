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
         user_id      AS id,
         fullname     AS name,
         email,
         avatar,
         phone,
         bio,
         website,
         twitter,
         instagram,
         banner
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




