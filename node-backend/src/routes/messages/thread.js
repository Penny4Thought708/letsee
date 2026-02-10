// /node-backend/src/routes/messages/thread.js
import pool from "../../db.js";

export default async function threadHandler(req, res) {
  try {
    const myUserId = req.session.user_id;
    if (!myUserId) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }

    const contactId = req.params.contactId;
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const sinceId = req.query.since_id ? Number(req.query.since_id) : null;

    const params = [myUserId, contactId];
    let sinceClause = "";

    if (sinceId) {
      sinceClause = "AND pm.id > $3";
      params.push(sinceId);
    }

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
        (
          (pm.sender_id = $1 AND pm.receiver_id = $2)
          OR
          (pm.sender_id = $2 AND pm.receiver_id = $1)
        )
        ${sinceClause}
      GROUP BY pm.id
      ORDER BY pm.created_at ASC
      LIMIT ${limit}
      `,
      params
    );

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
      ORDER BY created_at ASC
      `,
      [myUserId, contactId]
    );

    const combined = [...messageRows, ...voicemailRows].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    await pool.query(
      `
      UPDATE private_messages
      SET is_read = true
      WHERE receiver_id = $1 AND sender_id = $2
      `,
      [myUserId, contactId]
    );

    res.json({
      success: true,
      messages: combined,
      has_more: messageRows.length === limit,
      last_id:
        combined.length > 0 ? combined[combined.length - 1].id ?? null : null,
    });
  } catch (err) {
    console.error("[API /messages/thread] ERROR:", err);
    res.json({ success: false, error: "Server error" });
  }
}








