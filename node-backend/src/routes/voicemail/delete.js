import db from "../../db.js";

export default async function deleteHandler(req, res) {
  try {
    const { id } = req.body;

    await db.query(`DELETE FROM voicemails WHERE id=$1`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("[voicemail/delete] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}
