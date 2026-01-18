import pool from "../../db.js";

export default async function hidden(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT pm.id, pm.message, pm.sender_id, u.fullname AS sender_name
       FROM user_deleted_messages udm
       JOIN private_messages pm ON udm.message_id = pm.id
       JOIN users u ON pm.sender_id = u.user_id
       WHERE udm.user_id = $1
       ORDER BY pm.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("hidden error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
