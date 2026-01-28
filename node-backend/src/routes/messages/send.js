// /node-backend/src/routes/messages/send.js
import db from "../../db.js";

export default async function sendHandler(req, res) {
  try {
    const senderId = req.user.user_id;
    const { receiver_id, message, file, file_url } = req.body;

    if (!receiver_id) {
      return res.status(400).json({
        success: false,
        error: "Missing receiver_id"
      });
    }

    // Insert message
    const { rows } = await db.query(
      `
      INSERT INTO private_messages 
        (sender_id, receiver_id, message, file, file_url)
      VALUES 
        ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        senderId,
        receiver_id,
        message || "",
        file || false,
        file_url || null
      ]
    );

    const msg = rows[0];

    // Normalize for UI
    const normalized = {
      ...msg,
      is_me: true,
      reactions: [],
    };

    res.json({
      success: true,
      message: normalized
    });

  } catch (err) {
    console.error("[messages/send] error:", err);
    res.status(500).json({
      success: false,
      error: "Database error"
    });
  }
}


