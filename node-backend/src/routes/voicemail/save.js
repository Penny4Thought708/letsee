import db from "../../db.js";

export default async function saveHandler(req, res) {
  try {
    const { userId, fromId, audioUrl } = req.body;

    const { rows } = await db.query(
      `
      INSERT INTO voicemails (user_id, from_id, audio_url)
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [userId, fromId, audioUrl]
    );

    const vm = rows[0];

    res.json({ success: true, voicemail: vm });
  } catch (err) {
    console.error("[voicemail/save] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}
