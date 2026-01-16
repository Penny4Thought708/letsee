import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "../db.js";

const router = express.Router();

// ----------------------
// LOGIN
// ----------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query(
      "SELECT user_id, fullname, email, password, avatar FROM users WHERE email = $1",
      [email]
    );

    if (result.rowCount === 0) {
      return res.json({ success: false, error: "Email not found" });
    }

    const user = result.rows[0];

    // Fix PHP bcrypt prefix if needed
    let hash = user.password;
    if (hash.startsWith("$2y$")) {
      hash = "$2b$" + hash.substring(4);
    }

    const match = await bcrypt.compare(password, hash);
    if (!match) {
      return res.json({ success: false, error: "Password incorrect" });
    }

    // Create JWT
    const token = jwt.sign(
      {
        user_id: user.user_id,
        fullname: user.fullname,
        email: user.email,
        avatar: user.avatar
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ⭐ SET COOKIE (this is what dashboard needs)
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none"
    });

    return res.json({
      success: true,
      token,
      redirect: "dashboard.html"
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.json({ success: false, error: "Server error" });
  }
});

// ----------------------
// AUTH CHECK / ME
// ----------------------
router.get("/me", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.json({ success: false });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await db.query(
      "SELECT user_id, fullname, email, avatar FROM users WHERE user_id = $1",
      [decoded.user_id]
    );

    if (result.rowCount === 0) {
      return res.json({ success: false });
    }

    return res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (err) {
    return res.json({ success: false });
  }
});

export default router;

