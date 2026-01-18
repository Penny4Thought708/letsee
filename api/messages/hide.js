import pool from "../../db.js";

export default async function hide(req, res) {
  try {
    const userId = req.user.id;
    const { messageId } = req.body;

    await pool.query(
      `INSERT INTO user_deleted_messages (user_id, message_id)
       VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [userId, messageId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("hide error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
