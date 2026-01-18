import pool from "../../db.js";

export default async function deleteMsg(req, res) {
  try {
    const userId = req.user.id;
    const { messageId, everyone } = req.body;

    const check = await pool.query(
      `SELECT sender_id FROM private_messages WHERE id = $1`,
      [messageId]
    );

    if (!check.rowCount) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (everyone) {
      if (check.rows[0].sender_id !== userId) {
        return res.status(403).json({ error: "Not allowed" });
      }

      await pool.query(`DELETE FROM private_messages WHERE id = $1`, [
        messageId,
      ]);

      await pool.query(
        `DELETE FROM user_deleted_messages WHERE message_id = $1`,
        [messageId]
      );

      return res.json({ success: true });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("delete error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
