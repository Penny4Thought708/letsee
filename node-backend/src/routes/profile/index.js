import express from "express";
import authMiddleware from "../../middleware/auth.js";
import uploadAvatar from "../../middleware/uploadAvatar.js";

import {
  uploadAvatar as uploadAvatarCtrl,
  enhanceAvatar,
  removeAvatar,
  updateProfile,
  deleteAccount
} from "../../controllers/profileController.js";

const router = express.Router();

router.post("/avatar", authMiddleware, uploadAvatar.single("avatar"), uploadAvatarCtrl);
router.post("/avatar/enhance", authMiddleware, enhanceAvatar);
router.delete("/avatar", authMiddleware, removeAvatar);
router.put("/update", authMiddleware, updateProfile);
router.delete("/delete", authMiddleware, deleteAccount);

export default router;

