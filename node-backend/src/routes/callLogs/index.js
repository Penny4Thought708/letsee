// /node-backend/src/routes/callLogs/index.js
import express from "express";
import db from "../../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const myUserId = req.session.user_id;

    console.log("[API /call-logs] Session user_id:", myUserId);

    if (!myUserId) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }

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
      WHERE c.caller_id = $1 OR c.receiver_id = $1
      ORDER BY c.id DESC
      LIMIT $2 OFFSET $3
      `,
      [myUserId, limit, offset]
    );

    res.json({
      success: true,
      logs: result.rows,
      hasMore: result.rows.length === limit
    });

  } catch (err) {
    console.error("[call-logs] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

export default router;


