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
// Update Profile (Frontend-Compatible)
// ----------------------
export async function updateProfile(req, res) {
  try {
    const userId = req.session.user_id;

    if (!userId) {
      return res.json({ success: false, error: "Not authenticated" });
    }

    // Incoming fields from updated-profile.js
    const {
      displayName,
      email,
      about,
      website,
      social = {},
      preferences = {}
    } = req.body;

    // Map frontend → DB columns
    const fullname = displayName || null;
    const bio = about || null;
    const twitter = social.x || null;
    const instagram = social.instagram || null;
    const show_online = preferences.showStatus ?? true;
    const allow_messages = preferences.allowFriends ?? true;
    const theme = preferences.theme || "system";

    // Validate email
    if (!email || !email.trim()) {
      return res.json({ success: false, error: "Email cannot be empty" });
    }

    // Check email uniqueness
    const emailCheck = await db.query(
      "SELECT user_id FROM users WHERE email = $1 AND user_id != $2",
      [email, userId]
    );

    if (emailCheck.rows.length > 0) {
      return res.json({ success: false, error: "Email already in use" });
    }

    // Update DB
    const result = await db.query(
      `UPDATE users SET 
        fullname = $1,
        email = $2,
        bio = $3,
        website = $4,
        twitter = $5,
        instagram = $6,
        show_online = $7,
        allow_messages = $8,
        theme = $9
      WHERE user_id = $10
      RETURNING user_id, fullname, email, bio, website, twitter, instagram,
                show_online, allow_messages, avatar, banner, theme`,
      [
        fullname,
        email,
        bio,
        website,
        twitter,
        instagram,
        show_online,
        allow_messages,
        theme,
        userId
      ]
    );

    const updated = result.rows[0];

    // Update session
    req.session.fullname = updated.fullname;
    req.session.email = updated.email;
    req.session.bio = updated.bio;
    req.session.website = updated.website;
    req.session.twitter = updated.twitter;
    req.session.instagram = updated.instagram;
    req.session.show_online = updated.show_online;
    req.session.allow_messages = updated.allow_messages;
    req.session.theme = updated.theme;

    return res.json({ success: true, profile: updated });

  } catch (err) {
    console.error("Profile update error:", err);
    return res.json({ success: false, error: "Update failed" });
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


