// /node-backend/src/routes/messages/thread.js
import pool from "../../db.js";

export default async function threadHandler(req, res) {
  try {
    const myUserId = req.session.user_id;

    console.log("[API /messages/thread] Session user_id:", myUserId);

    if (!myUserId) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }

    const contactId = req.params.contactId;

    /* -------------------------------------------------------
       1. Load normal text/file messages
    ------------------------------------------------------- */
    const { rows: messageRows } = await pool.query(
      `
      SELECT 
        id,
        sender_id,
        receiver_id,
        message AS text,
        file_url,
        created_at,
        'message' AS type
      FROM private_messages
      WHERE 
        (sender_id = $1 AND receiver_id = $2)
        OR
        (sender_id = $2 AND receiver_id = $1)
      `,
      [myUserId, contactId]
    );

    /* -------------------------------------------------------
       2. Load voicemail messages
    ------------------------------------------------------- */
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

    /* -------------------------------------------------------
       3. Merge + sort by timestamp
    ------------------------------------------------------- */
    const combined = [...messageRows, ...voicemailRows].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    /* -------------------------------------------------------
       4. Mark ONLY normal messages as read
          (voicemail has its own "listened" endpoint)
    ------------------------------------------------------- */
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







