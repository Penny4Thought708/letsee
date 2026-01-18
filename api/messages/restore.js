import pool from "../../db.js";

export default async function restore(req, res) {
  try {
    const userId = req.user.id;
    const { messageId } = req.body;

    await pool.query(
      `DELETE FROM user_deleted_messages 
       WHERE user_id = $1 AND message_id = $2`,
      [userId, messageId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("restore error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
