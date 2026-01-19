import pool from "../../db.js";

export default async function thread(req, res) {
  try {
    const userId = req.user.id;
    const contactId = parseInt(req.params.contactId);

    if (!contactId) {
      return res.status(400).json({ error: "Invalid contactId" });
    }

    const result = await pool.query(
      `
      SELECT 
        pm.id,
        pm.sender_id,
        pm.receiver_id,
        pm.message,
        pm.type,
        pm.file_url,
        pm.created_at,

        su.fullname AS sender_name,
        su.avatar   AS sender_avatar,

        ru.fullname AS receiver_name,
        ru.avatar   AS receiver_avatar

      FROM private_messages pm
      JOIN users su ON pm.sender_id = su.id
      JOIN users ru ON pm.receiver_id = ru.id

      WHERE 
        (
          (pm.sender_id = $1 AND pm.receiver_id = $2)
          OR
          (pm.sender_id = $2 AND pm.receiver_id = $1)
        )
        AND pm.id NOT IN (
          SELECT message_id 
          FROM user_deleted_messages 
          WHERE user_id = $1
        )

      ORDER BY pm.created_at ASC
      `,
      [userId, contactId]
    );

    // Add is_me flag for frontend convenience
    const messages = result.rows.map((m) => ({
      ...m,
      is_me: m.sender_id === userId,
    }));

    res.json({ messages });

  } catch (err) {
    console.error("thread error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

