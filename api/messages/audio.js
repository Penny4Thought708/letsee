import multer from "multer";
import pool from "../../db.js";

const storage = multer.diskStorage({
  destination: "uploads/audio/",
  filename: (req, file, cb) => {
    const name = "audio_" + Date.now() + "_" + Math.floor(Math.random() * 9999) + ".webm";
    cb(null, name);
  },
});

const upload = multer({ storage });

export default [
  upload.single("audio"),
  async function audio(req, res) {
    try {
      const sender_id = req.user.id;
      const { to } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "No audio uploaded" });
      }

      const file_url = "/uploads/audio/" + req.file.filename;

      const result = await pool.query(
        `INSERT INTO private_messages 
         (sender_id, receiver_id, message, file, filename, file_url)
         VALUES ($1,$2,'',true,$3,$4)
         RETURNING *`,
        [sender_id, to, req.file.filename, file_url]
      );

      res.json({
        success: true,
        id: result.rows[0].id,
        url: file_url,
        filename: req.file.filename,
      });
    } catch (err) {
      console.error("audio error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
];
