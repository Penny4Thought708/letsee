// project-root/api/upload.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

const router = express.Router();

/* ============================================================
   ENSURE UPLOAD DIRECTORY EXISTS
============================================================ */
const uploadDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* ============================================================
   MULTER STORAGE
============================================================ */
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = file.originalname.split(".").pop();
    const name = Date.now() + "-" + Math.random().toString(36).slice(2);
    cb(null, `${name}.${ext}`);
  }
});

const upload = multer({ storage });

/* ============================================================
   UPLOAD ROUTE
============================================================ */
router.post("/", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    url: `/uploads/${req.file.filename}`
  });
});

export default router;
