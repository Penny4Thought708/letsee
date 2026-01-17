import express from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";

const router = express.Router();
const db = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
});

router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.session;
    if (!token) return res.status(401).json({ success: false, error: "No session" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.user_id;

    const result = await db.query(
      "SELECT user_id, fullname, avatar FROM users WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (err) {
    console.error("auth/me error:", err);
    res.status(401).json({ success: false, error: "Invalid session" });
  }
});

export default router;
