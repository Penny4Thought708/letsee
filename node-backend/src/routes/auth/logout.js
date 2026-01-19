import express from "express";

const router = express.Router();

// ----------------------
// LOGOUT
// ----------------------
router.post("/logout", (req, res) => {
  try {
    // Clear the JWT cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none"
    });

    return res.json({
      success: true,
      redirect: "index.html"
    });

  } catch (err) {
    console.error("Logout error:", err);
    return res.json({ success: false, error: "Server error" });
  }
});

export default router;
