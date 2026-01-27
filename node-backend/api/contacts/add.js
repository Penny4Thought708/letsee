import express from "express";
import pool from "../../db.js";

const router = express.Router();

// POST /api/contacts/add
router.post("/", async (req, res) => {
  try {
    const myUserId = req.session.user_id;
    const { contact_id } = req.body;

    if (!myUserId) {
      return res.json({ success: false, error: "Not logged in" });
    }

    if (!contact_id) {
      return res.json({ success: false, error: "Missing contact_id" });
    }

    await pool.query(
      `
      INSERT INTO contacts (user_id, contact_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, contact_id) DO NOTHING
      `,
      [myUserId, contact_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("POST /api/contacts/add error:", err);
    res.json({ success: false, error: "Server error" });
  }
});

export default router;
