// node-backend/src/routes/messages/delete.js (legacy)
import db from "../../db.js";

export default async function deleteHandler(req, res) {
  try {
    const userId = req.session.user_id; // ✅ FIXED
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: "Missing id" });
    }

    await db.query(
      `
      DELETE FROM private_messages
      WHERE id = $1 AND sender_id = $2
      `,
      [id, userId]
    );

    res.json({ success: true, deleted: id });
  } catch (err) {
    console.error("[messages/delete] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}
