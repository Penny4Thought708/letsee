// /node-backend/src/routes/messages/audio.js
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../../uploads/audio"));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname || ".webm"));
  }
});

const upload = multer({ storage });

// -------------------------------------------------------
// Export a clean handler function (matches your layout)
// -------------------------------------------------------
export default async function audioHandler(req, res) {
  upload.single("audio")(req, res, err => {
    if (err) {
      console.error("[messages/audio] Upload error:", err);
      return res.status(500).json({
        success: false,
        error: "Audio upload failed"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No audio file uploaded"
      });
    }

    const fileUrl = `/uploads/audio/${req.file.filename}`;

    res.json({
      success: true,
      url: fileUrl
    });
  });
}


