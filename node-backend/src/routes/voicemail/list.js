import db from "../../db.js";

export default async function listHandler(req, res) {
  try {
    const userId = req.user.user_id;

    const result = await db.query(
      `SELECT id, user_id, from_id, audio_url, transcript, peaks_json, created_at, listened
       FROM voicemails
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 100`,
      [userId]
    );

    res.json({ success: true, voicemails: result.rows });
  } catch (err) {
    console.error("[voicemail/list] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}
