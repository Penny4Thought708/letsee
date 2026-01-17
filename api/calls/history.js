// api/calls/history.js (or inside your calls router)

import express from "express";
import { authMiddleware } from "../core/auth.js";   // adjust path to your auth
import { db } from "../core/db.js";                 // your pg/Pool instance

const router = express.Router();

// GET /api/calls/history?offset=0&limit=30
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const offset = Number.parseInt(req.query.offset ?? "0", 10) || 0;
    const limit  = Number.parseInt(req.query.limit ?? "30", 10) || 30;

    const sql = `
      SELECT 
          cl.id,
          cl.caller_id,
          cl.receiver_id,
          cl.call_type,
          cl.status,
          cl.duration,
          cl.timestamp,

          uc.fullname AS caller_name,
          uc.avatar   AS caller_avatar,

          ur.fullname AS receiver_name,
          ur.avatar   AS receiver_avatar,

          -- Direction relative to logged‑in user
          CASE
              WHEN cl.caller_id = $1 THEN 'outgoing'
              ELSE 'incoming'
          END AS direction,

          -- Other party relative to logged‑in user
          CASE
              WHEN cl.caller_id = $1 THEN cl.receiver_id
              ELSE cl.caller_id
          END AS other_party_id,

          -- Last message text
          (
              SELECT pm.message
              FROM private_messages pm
              WHERE 
                  (
                      pm.sender_id = $1 
                      AND pm.receiver_id = 
                          CASE WHEN cl.caller_id = $1 THEN cl.receiver_id ELSE cl.caller_id END
                  )
                  OR
                  (
                      pm.sender_id = 
                          CASE WHEN cl.caller_id = $1 THEN cl.receiver_id ELSE cl.caller_id END
                      AND pm.receiver_id = $1
                  )
              ORDER BY pm.created_at DESC
              LIMIT 1
          ) AS last_message,

          -- Last message timestamp
          (
              SELECT pm.created_at
              FROM private_messages pm
              WHERE 
                  (
                      pm.sender_id = $1 
                      AND pm.receiver_id = 
                          CASE WHEN cl.caller_id = $1 THEN cl.receiver_id ELSE cl.caller_id END
                  )
                  OR
                  (
                      pm.sender_id = 
                          CASE WHEN cl.caller_id = $1 THEN cl.receiver_id ELSE cl.caller_id END
                      AND pm.receiver_id = $1
                  )
              ORDER BY pm.created_at DESC
              LIMIT 1
          ) AS last_message_time,

          -- Last message sender
          (
              SELECT pm.sender_id
              FROM private_messages pm
              WHERE 
                  (
                      pm.sender_id = $1 
                      AND pm.receiver_id = 
                          CASE WHEN cl.caller_id = $1 THEN cl.receiver_id ELSE cl.caller_id END
                  )
                  OR
                  (
                      pm.sender_id = 
                          CASE WHEN cl.caller_id = $1 THEN cl.receiver_id ELSE cl.caller_id END
                      AND pm.receiver_id = $1
                  )
              ORDER BY pm.created_at DESC
              LIMIT 1
          ) AS last_message_sender_id

      FROM call_logs cl
      LEFT JOIN users uc ON cl.caller_id = uc.user_id
      LEFT JOIN users ur ON cl.receiver_id = ur.user_id

      WHERE cl.caller_id = $1 OR cl.receiver_id = $1
      ORDER BY cl.timestamp DESC
      LIMIT $3 OFFSET $2
    `;

    const { rows } = await db.query(sql, [userId, offset, limit]);

    res.json({
      success: true,
      userId,
      data: rows,
      hasMore: rows.length === limit
    });
  } catch (err) {
    console.error("GET /api/calls/history error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to load call history"
    });
  }
});

export default router;
