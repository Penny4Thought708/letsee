// /node-backend/src/routes/messages/react.js
import db from "../../db.js";

export default async function reactHandler(req, res) {
  try {
    const userId = req.user.user_id;
    const { message_id, emoji } = req.body;

    if (!message_id || !emoji) {
      return res.status(400).json({
        success: false,
        error: "Missing message_id or emoji"
      });
    }

    // Check if reaction already exists
    const existing = await db.query(
      `
      SELECT id FROM message_reactions
      WHERE message_id = $1 AND user_id = $2 AND emoji = $3
      `,
      [message_id, userId, emoji]
    );

    if (existing.rows.length > 0) {
      // Remove reaction
      await db.query(
        `
        DELETE FROM message_reactions
        WHERE message_id = $1 AND user_id = $2 AND emoji = $3
        `,
        [message_id, userId, emoji]
      );

      return res.json({
        success: true,
        action: "removed",
        message_id,
        emoji
      });
    }

    // Add reaction
    await db.query(
      `
      INSERT INTO message_reactions (message_id, user_id, emoji)
      VALUES ($1, $2, $3)
      `,
      [message_id, userId, emoji]
    );

    res.json({
      success: true,
      action: "added",
      message_id,
      emoji
    });

  } catch (err) {
    console.error("[messages/react] error:", err);
    res.status(500).json({
      success: false,
      error: "Database error"
    });
  }
}
