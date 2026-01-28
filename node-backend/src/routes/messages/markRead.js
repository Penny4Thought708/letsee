// /node-backend/src/routes/messages/markRead.js
import db from "../../db.js";

export default async function markReadHandler(req, res) {
  try {
    const userId = req.user.user_id;
    const { from_id } = req.body;   // sender of unread messages

    if (!userId || !from_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    // Get all unread message IDs BEFORE updating
    const unread = await db.query(
      `
      SELECT id
      FROM private_messages
      WHERE receiver_id = $1
        AND sender_id = $2
        AND is_read = false
      `,
      [userId, from_id]
    );

    const unreadIds = unread.rows.map(r => r.id);

    // Mark them as read
    await db.query(
      `
      UPDATE private_messages
      SET is_read = true
      WHERE receiver_id = $1
        AND sender_id = $2
        AND is_read = false
      `,
      [userId, from_id]
    );

    res.json({
      success: true,
      updated_ids: unreadIds,
      count: unreadIds.length
    });

  } catch (err) {
    console.error("[messages/mark-read] error:", err);
    res.status(500).json({
      success: false,
      error: "Database error"
    });
  }
}
