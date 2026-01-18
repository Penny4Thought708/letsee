import multer from "multer";
import pool from "../../db.js";

const storage = multer.diskStorage({
  destination: "uploads/files/",
  filename: (req, file, cb) => {
    const name = Date.now() + "_" + file.originalname;
    cb(null, name);
  },
});

const upload = multer({ storage });

export default [
  upload.single("attachment"),
  async function uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const url = "/uploads/files/" + req.file.filename;

      res.json({
        success: true,
        url,
        filename: req.file.filename,
      });
    } catch (err) {
      console.error("upload error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
];
