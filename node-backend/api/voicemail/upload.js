import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../../db.js";

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "uploads/voicemail");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    const name = `vm_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({ storage });

router.get("/list", async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.json({ success: false, error: "Not authenticated" });
    }

    const result = await db.query(
      `
      SELECT 
        v.id,
        v.from_id,
        u.name AS from_name,
        u.avatar_url AS from_avatar,
        v.audio_url,
        v.transcript,
        v.timestamp,
        v.listened,
        v.peaks_json
      FROM voicemail v
      JOIN users u ON u.id = v.from_id
      WHERE v.user_id = $1
      ORDER BY v.timestamp DESC
      `,
      [userId]
    );

    return res.json({ success: true, voicemails: result.rows });

  } catch (err) {
    console.error("[voicemail list] ERROR:", err);
    return res.json({ success: false, error: "Server error" });
  }
});

export default router;
