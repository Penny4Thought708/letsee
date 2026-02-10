// node-backend/src/routes/messages/delete-for-me.js
import db from "../../db.js";

export default async function deleteForMeHandler(req, res) {
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
      INSERT INTO user_deleted_messages (user_id, message_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [userId, message_id]
    );

    res.json({ success: true, action: "deleted_for_me", message_id });
  } catch (err) {
    console.error("[messages/delete-for-me] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}
