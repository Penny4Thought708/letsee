// node-backend/src/routes/messages/restore.js
import db from "../../db.js";

export default async function restoreHandler(req, res) {
  try {
    const userId = req.session.user_id; // ✅ FIXED
    const { message_id } = req.body;

    if (!message_id) {
      return res
        .status(400)
        .json({ success: false, error: "Missing message_id" });
    }

    await db.query(
      `
      DELETE FROM user_deleted_messages
      WHERE user_id = $1 AND message_id = $2
      `,
      [userId, message_id]
    );

    res.json({ success: true, action: "restored", message_id });
  } catch (err) {
    console.error("[messages/restore] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}

