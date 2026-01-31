import db from "../db.js";

// ----------------------
// Avatar Upload
// ----------------------
export async function uploadAvatarCtrl(req, res) {
  try {
    const userId = req.session.user_id;
    const filename = req.file.filename;

    await db.query(
      "UPDATE users SET avatar = $1 WHERE user_id = $2",
      [filename, userId]
    );

    res.json({ success: true, avatar: "/uploads/avatars/" + filename });
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.json({ success: false, error: "Upload failed" });
  }
}

// ----------------------
// Banner Upload
// ----------------------
export async function uploadBannerCtrl(req, res) {
  try {
    const userId = req.session.user_id;
    const filename = req.file.filename;

    await db.query(
      "UPDATE users SET banner = $1 WHERE user_id = $2",
      [filename, userId]
    );

    res.json({ success: true, banner: "/uploads/banners/" + filename });
  } catch (err) {
    console.error("Banner upload error:", err);
    res.json({ success: false, error: "Upload failed" });
  }
}

// ----------------------
// Remove Avatar
// ----------------------
export async function removeAvatar(req, res) {
  try {
    const userId = req.session.user_id;

    await db.query(
      "UPDATE users SET avatar = NULL WHERE user_id = $1",
      [userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Remove avatar error:", err);
    res.json({ success: false, error: "Failed to remove avatar" });
  }
}

// ----------------------
// Remove Banner
// ----------------------
export async function removeBanner(req, res) {
  try {
    const userId = req.session.user_id;

    await db.query(
      "UPDATE users SET banner = NULL WHERE user_id = $1",
      [userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Remove banner error:", err);
    res.json({ success: false, error: "Failed to remove banner" });
  }
}

// ----------------------
// Enhance Avatar (placeholder)
// ----------------------
export async function enhanceAvatar(req, res) {
  try {
    const userId = req.session.user_id;

    const result = await db.query(
      "SELECT avatar FROM users WHERE user_id = $1",
      [userId]
    );

    const avatar = result.rows[0]?.avatar;
    if (!avatar) return res.json({ success: false, error: "No avatar to enhance" });

    res.json({ success: true, avatar });
  } catch (err) {
    console.error("Enhance error:", err);
    res.json({ success: false, error: "Enhance failed" });
  }
}

// ----------------------
// Update Profile (Auto-save + Manual Save)
// ----------------------
export async function updateProfile(req, res) {
  try {
    const userId = req.session.user_id;

    const {
      fullname,
      email,
      bio,
      website,
      twitter,
      instagram,
      show_online,
      allow_messages,
      avatar,
      banner,
      theme
    } = req.body;

    await db.query(
      `UPDATE users SET 
        fullname = $1,
        email = $2,
        bio = $3,
        website = $4,
        twitter = $5,
        instagram = $6,
        show_online = $7,
        allow_messages = $8,
        avatar = $9,
        banner = $10,
        theme = $11
      WHERE user_id = $12`,
      [
        fullname,
        email,
        bio,
        website,
        twitter,
        instagram,
        show_online,
        allow_messages,
        avatar,
        banner,
        theme,
        userId
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Profile update error:", err);
    res.json({ success: false, error: "Update failed" });
  }
}

// ----------------------
// Email Validation
// ----------------------
export async function checkEmail(req, res) {
  const { email } = req.query;

  const result = await db.query(
    "SELECT 1 FROM users WHERE email = $1",
    [email]
  );

  res.json({ success: true, available: result.rowCount === 0 });
}

// ----------------------
// Security Activity Log
// ----------------------
export async function getActivity(req, res) {
  const userId = req.session.user_id;

  const sessions = await db.query(
    "SELECT sid, expire FROM session WHERE sess::json->>'user_id' = $1",
    [String(userId)]
  );

  res.json({ success: true, sessions: sessions.rows });
}

// ----------------------
// Delete Account
// ----------------------
export async function deleteAccount(req, res) {
  try {
    const userId = req.session.user_id;

    await db.query("DELETE FROM users WHERE user_id = $1", [userId]);

    req.session.destroy(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error("Delete account error:", err);
    res.json({ success: false, error: "Failed to delete account" });
  }
}


