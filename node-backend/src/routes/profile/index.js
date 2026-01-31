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

// Upload avatar
router.post("/avatar", authMiddleware, uploadAvatar.single("avatar"), uploadAvatarCtrl);

// Enhance avatar
router.post("/avatar/enhance", authMiddleware, enhanceAvatar);

// Remove avatar
router.delete("/avatar", authMiddleware, removeAvatar);

// Update profile
router.put("/update", authMiddleware, updateProfile);

// Delete account
router.delete("/delete", authMiddleware, deleteAccount);

export default router;
