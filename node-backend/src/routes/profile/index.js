import express from "express";
import auth from "../../middleware/auth.js";
import uploadAvatar from "../../middleware/uploadAvatar.js";
import uploadBanner from "../../middleware/uploadBanner.js";

import {
  uploadAvatarCtrl,
  uploadBannerCtrl,
  enhanceAvatar,
  removeAvatar,
  removeBanner,
  updateProfile,
  deleteAccount,
  checkEmail,
  getActivity
} from "../../controllers/profileController.js";

const router = express.Router();

// Avatar
router.post("/avatar", auth, uploadAvatar.single("avatar"), uploadAvatarCtrl);
router.post("/avatar/enhance", auth, enhanceAvatar);
router.delete("/avatar", auth, removeAvatar);

// Banner
router.post("/banner", auth, uploadBanner.single("banner"), uploadBannerCtrl);
router.delete("/banner", auth, removeBanner);

// Profile update (auto-save + manual save)
router.put("/update", auth, updateProfile);

// Email validation
router.get("/check-email", auth, checkEmail);

// Security activity log
router.get("/activity", auth, getActivity);

// Delete account
router.delete("/delete", auth, deleteAccount);

export default router;


