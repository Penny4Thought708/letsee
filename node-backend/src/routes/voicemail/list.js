import db from "../../db.js";

export default async function listHandler(req, res) {
  try {
    const myUserId = req.session.user_id;

    if (!myUserId) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }

    const result = await db.query(
      `
         SELECT 
        v.id,
        v.user_id,
        v.from_id,
        u.fullname AS from_name,
        u.avatar AS from_avatar,
        u.theme AS from_theme,
        v.audio_url,
        v.transcript,
        v.peaks_json,
        v.created_at,
        v.listened
      FROM voicemails v
      JOIN users u ON u.user_id = v.from_id
      WHERE v.user_id = $1
      ORDER BY v.id DESC
      LIMIT 100

      `,
      [myUserId]
    );

    res.json({
      success: true,
      voicemails: result.rows
    });

  } catch (err) {
    console.error("[voicemail/list] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}





