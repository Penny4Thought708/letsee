// node-backend/src/routes/messages/delete-for-everyone.js
import db from "../../db.js";

export default async function deleteForEveryoneHandler(req, res) {
  try {
    const userId = req.session.user_id; // ✅ FIXED
    const { message_id } = req.body;

    if (!message_id) {
      return res
        .status(400)
        .json({ success: false, error: "Missing message_id" });
    }

    const { rows } = await db.query(
      `SELECT sender_id FROM private_messages WHERE id = $1`,
      [message_id]
    );

    if (!rows.length || rows[0].sender_id !== userId) {
      return res.status(403).json({ success: false, error: "Not allowed" });
    }

    await db.query(`DELETE FROM private_messages WHERE id = $1`, [message_id]);

    res.json({ success: true, action: "deleted_for_everyone", message_id });
  } catch (err) {
    console.error("[messages/delete-for-everyone] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}

