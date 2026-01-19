import db from "../../db.js";

export default async function listenedHandler(req, res) {
  try {
    const { id } = req.body;

    await db.query(`UPDATE voicemails SET listened=true WHERE id=$1`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("[voicemail/listened] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}
