import db from "../../db.js";

export default async function markReadHandler(req, res) {
  try {
    const userId = req.user.user_id;
    const { messageId } = req.body;

    await db.query(
      `UPDATE private_messages
       SET is_read = true
       WHERE id = $1 AND receiver_id = $2`,
      [messageId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[messages/mark-read] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}
