// node-backend/src/routes/contacts/index.js
import express from "express";
import db from "../../db.js";
import authMiddleware from "../../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/contacts
 * Returns:
 *  - contacts[]  (non-blocked)
 *  - blocked[]   (blocked contacts)
 *  - each contact includes last_message + unread count
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all contacts for this user
    const { rows } = await db.query(
      `
      SELECT 
        u.user_id      AS id,
        u.fullname     AS name,
        u.email        AS email,
        u.avatar       AS avatar,   -- RAW from DB
        u.banner       AS banner,   -- RAW from DB
        u.phone        AS phone,
        u.bio          AS bio,
        c.blocked      AS blocked,
        c.is_favorite  AS favorite,
        c.created_at   AS added_on
      FROM contacts c
      JOIN users u ON c.contact_id = u.user_id
      WHERE c.user_id = $1
      ORDER BY u.fullname ASC
      `,
      [userId]
    );

    const contacts = [];
    const blocked = [];

    // Query for last message + unread count
    const lastMsgQuery = `
      SELECT 
        m.id,
        m.message,
        m.file_url,
        m.type,
        m.created_at,
        (
          SELECT COUNT(*) 
          FROM private_messages
          WHERE receiver_id = $1 
            AND sender_id = $2 
            AND is_read = false
        ) AS unread
      FROM private_messages m
      WHERE 
        (m.sender_id = $2 AND m.receiver_id = $1)
        OR
        (m.sender_id = $1 AND m.receiver_id = $2)
      ORDER BY m.created_at DESC
      LIMIT 1
    `;

    for (const row of rows) {
      const contactId = row.id;

      // Fetch last message for this contact
      const msgRes = await db.query(lastMsgQuery, [userId, contactId]);
      const last = msgRes.rows[0] || {};

      const contact = {
        id: contactId,
        name: row.name,
        email: row.email,

        // Return raw DB values — frontend handles prefixing
        avatar: row.avatar,
        banner: row.banner,

        phone: row.phone,
        bio: row.bio,
        favorite: row.favorite,
        added_on: row.added_on,

        online: false, // updated by WebSocket on frontend

        last_message: {
          id: last.id ?? null,
          text: last.message ?? null,
          type: last.type ?? "text",
          file_url: last.file_url ?? null,
          created_at: last.created_at ?? null,
          unread: Number(last.unread ?? 0)
        }
      };

      if (row.blocked) blocked.push(contact);
      else contacts.push(contact);
    }

    res.json({
      success: true,
      contacts,
      blocked
    });

  } catch (err) {
    console.error("GET /api/contacts error:", err);
    res.json({
      success: false,
      contacts: [],
      blocked: [],
      error: err.message
    });
  }
});

export default router;








