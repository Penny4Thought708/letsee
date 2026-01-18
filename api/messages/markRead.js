import pool from "../../db.js";

export default async function markRead(req, res) {
  try {
    const { messageId } = req.body;

    await pool.query(
      `UPDATE private_messages SET is_read = true WHERE id = $1`,
      [messageId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("markRead error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
