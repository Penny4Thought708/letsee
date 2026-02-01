import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../../db.js";

const router = express.Router();

// Ensure voicemail upload directory exists
const uploadDir = path.join(process.cwd(), "uploads/voicemail");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    const name = `vm_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({ storage });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const fromUserId = req.session.user_id;
    const toUserId = req.body.toUserId;
    const file = req.file;

    if (!fromUserId) {
      return res.json({ success: false, error: "Not authenticated" });
    }

    if (!toUserId) {
      return res.json({ success: false, error: "Missing toUserId" });
    }

    if (!file) {
      return res.json({ success: false, error: "No file uploaded" });
    }

    const filePath = `/uploads/voicemail/${file.filename}`;

await db.query(
  `INSERT INTO voicemails (from_id, user_id, audio_url, created_at)
   VALUES ($1, $2, $3, NOW())`,
  [fromUserId, toUserId, filePath]
);


    return res.json({ success: true, file: filePath });

  } catch (err) {
    console.error("[voicemail upload] ERROR:", err);
    return res.json({ success: false, error: "Server error" });
  }
});

export default router;

