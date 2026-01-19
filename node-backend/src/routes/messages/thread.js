import db from "../../db.js";

export default async function threadHandler(req, res) {
  try {
    const userId = req.user.user_id;
    const contactId = req.params.contactId;

    const { rows } = await db.query(
      `
      SELECT *
      FROM private_messages
      WHERE 
        (sender_id=$1 AND receiver_id=$2)
        OR
        (sender_id=$2 AND receiver_id=$1)
      ORDER BY created_at ASC
      `,
      [userId, contactId]
    );

    await db.query(
      `UPDATE private_messages SET is_read=true WHERE receiver_id=$1 AND sender_id=$2`,
      [userId, contactId]
    );

    res.json({ success: true, messages: rows });
  } catch (err) {
    console.error("[messages/thread] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}
