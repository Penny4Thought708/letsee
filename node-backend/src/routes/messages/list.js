import db from "../../db.js";

export default async function listHandler(req, res) {
  try {
    const userId = req.user.user_id;

    const { rows } = await db.query(
      `
      SELECT DISTINCT ON (contact_id)
        contact_id,
        contact_name,
        contact_avatar,
        last_message,
        last_message_at
      FROM message_threads
      WHERE user_id=$1
      ORDER BY contact_id, last_message_at DESC
      `,
      [userId]
    );

    res.json({ success: true, threads: rows });
  } catch (err) {
    console.error("[messages/list] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}
