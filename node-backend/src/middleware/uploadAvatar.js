import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: "uploads/avatars/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = "avatar_" + Date.now() + ext;
    cb(null, name);
  }
});

export default multer({ storage });
