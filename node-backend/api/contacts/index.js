// /node-backend/api/contacts/index.js
import express from "express";
import pool from "../../src/db.js";


const router = express.Router();

// GET /api/contacts
router.get("/", async (req, res) => {
  try {
    const myUserId = req.session.user_id;

    console.log("[API /contacts] Session user_id:", myUserId);

    if (!myUserId) {
      return res.json({ success: false, error: "Not logged in" });
    }

    // Use LEFT JOIN so missing users don't hide contacts
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

    console.log("[API /contacts] Running query for user:", myUserId);

    const result = await pool.query(query, [myUserId]);

    console.log("[API /contacts] Raw DB rows:", result.rows);

    const contacts = [];
    const blocked = [];

    result.rows.forEach((row) => {
      if (!row.id) {
        console.warn("[API /contacts] WARNING: contact_id has no matching user record:", row);
      }

      if (row.blocked) blocked.push(row);
      else contacts.push(row);
    });

    console.log("[API /contacts] Final contacts:", contacts);
    console.log("[API /contacts] Final blocked:", blocked);

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
