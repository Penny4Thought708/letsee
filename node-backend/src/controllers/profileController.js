import db from "../db.js";

export async function uploadAvatar(req, res) {
  try {
    const userId = req.session.user_id;
    if (!userId) return res.json({ success: false, error: "Not logged in" });

    const filename = req.file.filename;

    await db.query(
      "UPDATE users SET avatar = $1 WHERE id = $2",
      [filename, userId]
    );

    res.json({
      success: true,
      avatar: "/uploads/avatars/" + filename
    });
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.json({ success: false, error: "Upload failed" });
  }
}

export async function enhanceAvatar(req, res) {
  try {
    const userId = req.session.user_id;

    const result = await db.query(
      "SELECT avatar FROM users WHERE id = $1",
      [userId]
    );

    const avatar = result.rows[0]?.avatar;
    if (!avatar) return res.json({ success: false, error: "No avatar to enhance" });

    // Placeholder: return same avatar
    res.json({ success: true, avatar });
  } catch (err) {
    console.error("Enhance error:", err);
    res.json({ success: false, error: "Enhance failed" });
  }
}

export async function removeAvatar(req, res) {
  try {
    const userId = req.session.user_id;

    await db.query("UPDATE users SET avatar = NULL WHERE id = $1", [userId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Remove avatar error:", err);
    res.json({ success: false, error: "Failed to remove avatar" });
  }
}

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
      avatar
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
        avatar = $9
      WHERE id = $10`,
      [
        fullname,
        email,
        bio,
        website,
        twitter,
        instagram,
        show_online ? 1 : 0,
        allow_messages ? 1 : 0,
        avatar,
        userId
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Profile update error:", err);
    res.json({ success: false, error: "Update failed" });
  }
}

export async function deleteAccount(req, res) {
  try {
    const userId = req.session.user_id;

    await db.query("DELETE FROM users WHERE id = $1", [userId]);

    req.session.destroy(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error("Delete account error:", err);
    res.json({ success: false, error: "Failed to delete account" });
  }
}
