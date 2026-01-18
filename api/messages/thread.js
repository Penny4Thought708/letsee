import pool from "../../db.js";

export default async function thread(req, res) {
  try {
    const userId = req.user.id;
    const contactId = parseInt(req.params.contactId);

    const result = await pool.query(
      `SELECT pm.*, 
              u.fullname AS sender_name
       FROM private_messages pm
       JOIN users u ON pm.sender_id = u.user_id
       WHERE 
         ((pm.sender_id = $1 AND pm.receiver_id = $2)
         OR
         (pm.sender_id = $2 AND pm.receiver_id = $1))
         AND pm.id NOT IN (
            SELECT message_id FROM user_deleted_messages WHERE user_id = $1
         )
       ORDER BY pm.created_at ASC`,
      [userId, contactId]
    );

    res.json({ messages: result.rows });
  } catch (err) {
    console.error("thread error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
