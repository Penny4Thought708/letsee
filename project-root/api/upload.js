import express from "express";
import multer from "multer";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "public/uploads",
  filename: (req, file, cb) => {
    const ext = file.originalname.split(".").pop();
    const name = Date.now() + "-" + Math.random().toString(36).slice(2);
    cb(null, `${name}.${ext}`);
  }
});

const upload = multer({ storage });

router.post("/", upload.single("image"), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

export default router;
