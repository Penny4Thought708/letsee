// /node-backend/api/contacts/index.js
import express from "express";
import pool from "../../src/db.js";
import authMiddleware from "../../middleware/auth.js";

const router = express.Router();

// GET /api/contacts
router.get("/", authMiddleware, async (req, res) => {
  try {
    const myUserId = req.user.user_id;

    console.log("[API /contacts] Auth user_id:", myUserId);

    const query = `
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
      LEFT JOIN users u ON u.user_id = c.contact_id
      WHERE c.user_id = $1
      ORDER BY u.fullname ASC NULLS LAST
    `;

    const result = await pool.query(query, [myUserId]);

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
    console.error("[API /contacts] ERROR:", err);
    res.json({ success: false, error: "Server error" });
  }
});

export default router;
