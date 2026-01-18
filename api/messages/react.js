import pool from "../../db.js";

export default async function react(req, res) {
  try {
    const { messageId, emoji } = req.body;

    const result = await pool.query(
      `UPDATE private_messages
       SET reactions = COALESCE(reactions, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('emoji',$1))
       WHERE id = $2
       RETURNING reactions`,
      [emoji, messageId]
    );

    res.json({
      success: true,
      reactions: result.rows[0].reactions,
    });
  } catch (err) {
    console.error("react error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
