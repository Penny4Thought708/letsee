import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rowCount === 0) {
      return res.json({ success: false, error: "Email address not registered" });
    }

    const user = result.rows[0];

    // ⭐ Fix PHP → Node bcrypt prefix
    let hash = user.password;
    if (hash.startsWith("$2y$")) {
      hash = "$2b$" + hash.substring(4);
    }

    const match = await bcrypt.compare(password, hash);
    if (!match) {
      return res.json({ success: false, error: "Password Incorrect" });
    }

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

    return res.json({
      success: true,
      token,
      redirect: "/dashboard.html"
    });

  } catch (err) {
    console.error(err);
    return res.json({ success: false, error: "Server error" });
  }
});


export default router;
