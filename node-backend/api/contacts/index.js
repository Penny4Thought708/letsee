// /api/contacts/index.js
import express from "express";
import pool from "../../db.js"; // adjust path to your db connection

const router = express.Router();

// GET /api/contacts
router.get("/", async (req, res) => {
  try {
    const myUserId = req.session.user_id;
    if (!myUserId) {
      return res.json({ success: false, error: "Not logged in" });
    }

    // Fetch contacts + JOIN users
    const result = await pool.query(
      `
      SELECT
        c.contact_id AS id,
        u.fullname AS name,
        u.email AS email,
        u.avatar AS avatar,
        u.phone AS phone,
        u.bio AS bio,
        u.website AS website,
        u.twitter AS twitter,
        u.instagram AS instagram,
        u.banner AS banner,
        c.is_favorite AS favorite,
        c.created_at AS added_on,
        u.show_online AS online,
        c.blocked AS blocked
      FROM contacts c
      JOIN users u ON u.user_id = c.contact_id
      WHERE c.user_id = $1
      ORDER BY u.fullname ASC
      `,
      [myUserId]
    );

    const contacts = [];
    const blocked = [];

    result.rows.forEach((row) => {
      if (row.blocked) blocked.push(row);
      else contacts.push(row);
    });

    res.json({
      success: true,
      contacts,
      blocked
    });
  } catch (err) {
    console.error("GET /api/contacts error:", err);
    res.json({ success: false, error: "Server error" });
  }
});

export default router;
