// /node-backend/src/routes/messages/thread.js
import pool from "../../db.js";

export default async function threadHandler(req, res) {
  try {
    const myUserId = req.session.user_id;

    if (!myUserId) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }

    const contactId = req.params.contactId;

    // Load normal messages + reactions
    const { rows: messageRows } = await pool.query(
      `
      SELECT 
        pm.id,
        pm.sender_id,
        pm.receiver_id,
        pm.message AS text,
        pm.file_url,
        pm.created_at,
        'message' AS type,
        COALESCE(
          json_agg(mr.emoji) FILTER (WHERE mr.emoji IS NOT NULL),
          '[]'
        ) AS reactions
      FROM private_messages pm
      LEFT JOIN message_reactions mr
        ON mr.message_id = pm.id
      WHERE 
        (pm.sender_id = $1 AND pm.receiver_id = $2)
        OR
        (pm.sender_id = $2 AND pm.receiver_id = $1)
      GROUP BY pm.id
      ORDER BY pm.created_at ASC
      `,
      [myUserId, contactId]
    );

    // Load voicemails
    const { rows: voicemailRows } = await pool.query(
      `
      SELECT
        id,
        from_id AS sender_id,
        user_id AS receiver_id,
        audio_url AS voicemail_url,
        created_at,
        'voicemail' AS type
      FROM voicemails
      WHERE 
        (from_id = $1 AND user_id = $2)
        OR
        (from_id = $2 AND user_id = $1)
      `,
      [myUserId, contactId]
    );

    // Merge
    const combined = [...messageRows, ...voicemailRows].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    // Mark text messages as read
    await pool.query(
      `
      UPDATE private_messages
      SET is_read = true
      WHERE receiver_id = $1 AND sender_id = $2
      `,
      [myUserId, contactId]
    );

    res.json({ success: true, messages: combined });

  } catch (err) {
    console.error("[API /messages/thread] ERROR:", err);
    res.json({ success: false, error: "Server error" });
  }
}








