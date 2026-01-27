// /node-backend/src/routes/messages/thread.js
import express from "express";
import pool from "../../db.js";

const router = express.Router();

// GET /api/messages/thread/:id
router.get("/thread/:id", async (req, res) => {
  try {
    const myUserId = req.session.user_id;

    console.log("[API /messages/thread] Session user_id:", myUserId);

    if (!myUserId) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }

    const contactId = req.params.id;

    const { rows } = await pool.query(
      `
      SELECT *
      FROM messages
      WHERE 
        (sender_id = $1 AND receiver_id = $2)
        OR
        (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at ASC
      `,
      [myUserId, contactId]
    );

    // Mark messages as seen
    await pool.query(
      `
      UPDATE messages
      SET seen = 1
      WHERE receiver_id = $1 AND sender_id = $2
      `,
      [myUserId, contactId]
    );

    res.json({ success: true, messages: rows });

  } catch (err) {
    console.error("[API /messages/thread] ERROR:", err);
    res.json({ success: false, error: "Server error" });
  }
});

export default router;


