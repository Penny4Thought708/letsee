import pool from "../../db.js";

export default async function edit(req, res) {
  try {
    const userId = req.user.id;
    const { messageId, message } = req.body;

    const check = await pool.query(
      `SELECT sender_id FROM private_messages WHERE id = $1`,
      [messageId]
    );

    if (!check.rowCount || check.rows[0].sender_id !== userId) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const result = await pool.query(
      `UPDATE private_messages SET message = $1 WHERE id = $2 RETURNING *`,
      [message, messageId]
    );

    res.json({ success: true, ...result.rows[0] });
  } catch (err) {
    console.error("edit error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
