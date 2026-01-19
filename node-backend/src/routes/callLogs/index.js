import express from "express";
import db from "../../db.js";
import authMiddleware from "../../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const offset = parseInt(req.query.offset || "0", 10);
    const limit = parseInt(req.query.limit || "30", 10);

    const result = await db.query(
      `
      SELECT 
        c.id,
        c.caller_id,
        caller.fullname   AS caller_name,
        caller.avatar     AS caller_avatar,
        c.receiver_id,
        receiver.fullname AS receiver_name,
        receiver.avatar   AS receiver_avatar,
        c.call_type,
        c.direction,
        c.status,
        c.duration,
        c.timestamp,
        c.created_at
      FROM call_logs c
      JOIN users caller   ON caller.user_id   = c.caller_id
      JOIN users receiver ON receiver.user_id = c.receiver_id
      ORDER BY c.id DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    res.json({
      logs: result.rows,
      hasMore: result.rows.length === limit
    });
  } catch (err) {
    console.error("[call-logs] error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
