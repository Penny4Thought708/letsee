import express from "express";
import db from "../../db.js";
import authMiddleware from "../../middleware/auth.js";

const router = express.Router();

router.get("/search", authMiddleware, async (req, res) => {
  try {
    const q = `%${req.query.query || ""}%`;

    const result = await db.query(
      `SELECT 
         user_id      AS contact_id,
         fullname     AS contact_name,
         email        AS contact_email,
         avatar       AS contact_avatar
       FROM users
       WHERE fullname ILIKE $1 OR email ILIKE $1
       ORDER BY fullname ASC
       LIMIT 20`,
      [q]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[lookup] error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
