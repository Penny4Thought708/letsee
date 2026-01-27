import express from "express";
import pool from "../../db.js";

const router = express.Router();

// POST /api/contacts/unblock
router.post("/", async (req, res) => {
  try {
    const myUserId = req.session.user_id;
    const { contact_id } = req.body;

    if (!myUserId) {
      return res.json({ success: false, error: "Not logged in" });
    }

    await pool.query(
      `
      UPDATE contacts
      SET blocked = false
      WHERE user_id = $1 AND contact_id = $2
      `,
      [myUserId, contact_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("POST /api/contacts/unblock error:", err);
    res.json({ success: false, error: "Server error" });
  }
});

export default router;
