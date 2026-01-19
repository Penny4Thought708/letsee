import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export default [
  upload.single("audio"),
  (req, res) => {
    const fileUrl = `/uploads/audio/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
  }
];
