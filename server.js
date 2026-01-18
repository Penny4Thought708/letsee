// -------------------------------------------------------
// server.js — Realtime Backend (WebRTC + Presence + Voicemail + Auth)
// Postgres / Neon version — Inline Routes Version (Option A)
// -------------------------------------------------------

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import WaveformData from "waveform-data";
import registerWebRTCHandlers from "./sockets/webrtc.js";
import authMiddleware from "middleware/authMiddleware.js";


import pkg from "pg";
const { Pool } = pkg;

// -------------------------------------------------------
// Database (Postgres / Neon)
// -------------------------------------------------------
const db = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// -------------------------------------------------------
// Express + HTTP + Socket.IO
// -------------------------------------------------------
const app = express();
const server = http.createServer(app);

// -------------------------------------------------------
// CORS (GitHub Pages + Render + localhost)
// -------------------------------------------------------
const allowedOrigins = [
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "https://letsee-vv23.onrender.com",
  "https://letsee-backend.onrender.com",
  "https://penny4thought708.github.io",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Preflight (GitHub Pages → Render)
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "https://penny4thought708.github.io");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.sendStatus(200);
});

app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());

// -------------------------------------------------------
// Health Route
// -------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// -------------------------------------------------------
// Auth Routes
// -------------------------------------------------------
import authRouter from "./auth/login.js";
import authMeRouter from "./auth/me.js";

app.use("/api/auth", authRouter);
app.use("/api/auth", authMeRouter);

import messagesRouter from "./api/messages/index.js";
app.use("/api/messages", messagesRouter);

// -------------------------------------------------------
// ⭐ INLINE CONTACTS API (Corrected for your schema)
// -------------------------------------------------------
app.get("/api/contacts", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await db.query(`
      SELECT 
        u.user_id        AS contact_id,
        u.fullname       AS contact_name,
        u.email          AS contact_email,
        u.avatar         AS avatar_filename,
        u.phone          AS contact_phone,
        u.bio            AS contact_bio,
        u.banner         AS contact_banner,
        c.blocked        AS blocked,
        c.is_favorite    AS is_favorite,
        c.created_at     AS added_on
      FROM contacts c
      JOIN users u ON c.contact_id = u.user_id
      WHERE c.user_id = $1
      ORDER BY u.fullname ASC
    `, [userId]);

    const contacts = [];
    const blocked = [];

    const msgQuery = `
      SELECT 
        m.message,
        m.created_at,
        (
          SELECT COUNT(*) FROM messages 
          WHERE receiver_id = $1 AND sender_id = $2 AND seen = 0
        ) AS unread_count
      FROM messages m
      WHERE 
        (m.sender_id = $2 AND m.receiver_id = $1)
        OR
        (m.sender_id = $1 AND m.receiver_id = $2)
      ORDER BY m.created_at DESC
      LIMIT 1
    `;

    for (const row of rows) {
      const contactId = row.contact_id;

      const msg = await db.query(msgQuery, [userId, contactId]);
      const last = msg.rows[0] || {};

      const contact = {
        contact_id: contactId,
        contact_name: row.contact_name,
        contact_email: row.contact_email,
        contact_avatar: row.avatar_filename
          ? `/uploads/avatars/${row.avatar_filename}`
          : `/img/defaultUser.png`,
        contact_phone: row.contact_phone,
        contact_bio: row.contact_bio,
        contact_banner: row.contact_banner
          ? `/uploads/banners/${row.contact_banner}`
          : `/img/profile-banner.jpg`,
        is_favorite: row.is_favorite,
        added_on: row.added_on,
        online: false,

        last_message: last.message || null,
        last_message_at: last.created_at || null,
        unread_count: Number(last.unread_count || 0)
      };

      if (row.blocked) blocked.push(contact);
      else contacts.push(contact);
    }

    res.json({ contacts, blocked, error: null });

  } catch (err) {
    console.error("[contacts] DB error:", err);
    res.json({ contacts: [], blocked: [], error: err.message });
  }
});


// Block contact
app.post("/api/contacts/block", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contact_id } = req.body;

    await db.query(
      `INSERT INTO blocked_contacts (user_id, blocked_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, contact_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[contacts] block error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Unblock contact
app.post("/api/contacts/unblock", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contact_id } = req.body;

    await db.query(
      `DELETE FROM blocked_contacts
       WHERE user_id = $1 AND blocked_id = $2`,
      [userId, contact_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[contacts] unblock error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Delete contact
app.post("/api/contacts/delete", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contact_id } = req.body;

    await db.query(
      `DELETE FROM contacts
       WHERE owner_id = $1 AND id = $2`,
      [userId, contact_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[contacts] delete error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// -------------------------------------------------------
// ⭐ INLINE USERS LOOKUP SEARCH (Corrected for your schema)
// -------------------------------------------------------
app.get("/api/users/search", authMiddleware, async (req, res) => {
  try {
    const q = `%${req.query.query || ""}%`;

    const result = await db.query(
      `SELECT 
         user_id      AS contact_id,
         fullname     AS contact_name,
         email        AS contact_email,
         avatar       AS contact_avatar
       FROM users
       WHERE fullname ILIKE $1 OR email ILIKE $1
       ORDER BY fullname ASC
       LIMIT 20`,
      [q]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[lookup] error:", err);
    res.status(500).json({ error: "Database error" });
  }
});


// -------------------------------------------------------
// ⭐ INLINE MESSAGES API (Corrected for your schema)
// -------------------------------------------------------
app.get("/api/messages/thread/:contactId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.contactId;

    const result = await db.query(
      `SELECT *
       FROM private_messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY id ASC`,
      [userId, contactId]
    );

    res.json({ messages: result.rows });
  } catch (err) {
    console.error("[messages] DB error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/messages/send", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { to, text } = req.body;

    const result = await db.query(
      `INSERT INTO private_messages (sender_id, receiver_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, to, text]
    );

    res.json({ success: true, message: result.rows[0] });
  } catch (err) {
    console.error("[messages] send error:", err);
    res.status(500).json({ error: "Database error" });
  }
});


// -------------------------------------------------------
// ⭐ INLINE VOICEMAIL API
// -------------------------------------------------------
app.get("/api/voicemail/list", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, user_id, from_id, audio_url, transcript, peaks_json, created_at, listened
       FROM voicemails
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 100`,
      [userId]
    );

    res.json({ voicemails: result.rows });
  } catch (err) {
    console.error("[voicemail] Error loading list:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/voicemail/mark-listened", authMiddleware, async (req, res) => {
  try {
    const { id } = req.body;

    await db.query(
      `UPDATE voicemails SET listened = 1 WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[voicemail] mark-listened error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/voicemail/delete", authMiddleware, async (req, res) => {
  try {
    const { id } = req.body;

    await db.query(`DELETE FROM voicemails WHERE id = $1`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("[voicemail] delete error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// -------------------------------------------------------
// ⭐ INLINE CALL LOGS API (with user avatars)
// -------------------------------------------------------
app.get("/api/call-logs", authMiddleware, async (req, res) => {
  try {
    const offset = parseInt(req.query.offset || "0", 10);
    const limit = parseInt(req.query.limit || "30", 10);

    const result = await db.query(
      `
      SELECT 
        c.id,
        c.caller_id,
        caller.fullname   AS caller_name,
        caller.avatar     AS caller_avatar,
        
        c.receiver_id,
        receiver.fullname AS receiver_name,
        receiver.avatar   AS receiver_avatar,

        c.call_type,
        c.direction,
        c.status,
        c.duration,
        c.timestamp,
        c.created_at
      FROM call_logs c
      JOIN users caller   ON caller.user_id   = c.caller_id
      JOIN users receiver ON receiver.user_id = c.receiver_id
      ORDER BY c.id DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    res.json({
      logs: result.rows,
      hasMore: result.rows.length === limit,
    });

  } catch (err) {
    console.error("[call-logs] DB error:", err);
    res.status(500).json({ error: "Database error" });
  }
});



// -------------------------------------------------------
// Socket.IO Setup
// -------------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// -------------------------------------------------------
// Presence / DND State
// -------------------------------------------------------
const onlineUsers = new Map();
const dndState = new Map();

const toStr = (v) => (v == null ? null : String(v));

function addOnlineUser(userId, socketId, fullname = null) {
  const key = toStr(userId);
  if (!key) return;

  let entry = onlineUsers.get(key);
  if (!entry) {
    entry = {
      socketIds: new Set(),
      fullname: fullname || null,
      lastSeen: Date.now(),
      away: false,
    };
    onlineUsers.set(key, entry);
  }

  entry.socketIds.add(socketId);
  if (fullname) entry.fullname = fullname;
  entry.lastSeen = Date.now();
}

function removeOnlineSocket(userId, socketId) {
  const key = toStr(userId);
  if (!key) return false;

  const entry = onlineUsers.get(key);
  if (!entry) return false;

  entry.socketIds.delete(socketId);

  if (entry.socketIds.size === 0) {
    onlineUsers.delete(key);
    return true;
  }

  return false;
}

function broadcastStatusUpdate(userId, { online, away }) {
  const idStr = toStr(userId);
  if (!idStr) return;

  io.emit("statusUpdate", {
    contact_id: idStr,
    online: !!online,
    away: !!away,
  });
}

function broadcastPresenceOnline(userId) {
  const idStr = toStr(userId);
  if (!idStr) return;

  console.log(`[presence] User online: userId=${idStr}`);
  broadcastStatusUpdate(idStr, { online: true, away: false });
  io.emit("presence:online", { user_id: idStr });
}

function broadcastPresenceOffline(userId) {
  const idStr = toStr(userId);
  if (!idStr) return;

  console.log(`[presence] User offline: userId=${idStr}`);
  broadcastStatusUpdate(idStr, { online: false, away: false });
  io.emit("presence:offline", { user_id: idStr });
}

// -------------------------------------------------------
// Blocked helper
// -------------------------------------------------------
async function isBlocked(receiverId, senderId) {
  const result = await db.query(
    "SELECT 1 FROM blocked_contacts WHERE user_id = $1 AND blocked_id = $2 LIMIT 1",
    [receiverId, senderId]
  );
  return result.rows.length > 0;
}

function isDND(userId) {
  return dndState.get(toStr(userId)) === true;
}
// -------------------------------------------------------
// Socket.IO Connection Handler
// -------------------------------------------------------
io.on("connection", (socket) => {
  console.log("[socket] Connected:", socket.id);

// -------------------------------------------------------
// Presence Sync
// -------------------------------------------------------
function registerPresenceSync(socket) {
  socket.on("presence:get", () => {
    const users = [];

    for (const [userId, entry] of onlineUsers.entries()) {
      users.push({
        contact_id: userId,
        online: true,
        away: entry.away || false,
      });
    }

    socket.emit("statusBatch", users);
  });
}

// -------------------------------------------------------
// Typing + Recording
// -------------------------------------------------------
function registerTypingAndRecording(socket, getCurrentUserId) {
  const safeId = (v) => toStr(v || getCurrentUserId());

  socket.on("typing:start", async ({ from, to }) => {
    const target = safeId(to);
    const sender = safeId(from);

    if (!target || !sender) return;
    if (await isBlocked(target, sender)) return;
    if (isDND(target)) return;

    const entry = onlineUsers.get(sender);
    const name = entry?.fullname || `User ${sender}`;

    io.to(target).emit("typing:start", {
      from: sender,
      fullname: name,
    });
  });

  socket.on("typing:stop", async ({ from, to }) => {
    const target = safeId(to);
    const sender = safeId(from);

    if (!target || !sender) return;
    if (await isBlocked(target, sender)) return;
    if (isDND(target)) return;

    io.to(target).emit("typing:stop", { from: sender });
  });

  socket.on("recording:start", async ({ from, to }) => {
    const target = safeId(to);
    const sender = safeId(from);

    if (!target || !sender) return;
    if (await isBlocked(target, sender)) return;
    if (isDND(target)) return;

    io.to(target).emit("recording:start", { from: sender });
  });

  socket.on("recording:stop", async ({ from, to }) => {
    const target = safeId(to);
    const sender = safeId(from);

    if (!target || !sender) return;
    if (await isBlocked(target, sender)) return;
    if (isDND(target)) return;

    io.to(target).emit("recording:stop", { from: sender });
  });
}

// -------------------------------------------------------
// Audio Messaging + Voicemail
// -------------------------------------------------------
function registerAudioMessaging(socket, getCurrentUserId) {
  socket.on("message:audio", async ({ from, to, url }) => {
    const target = toStr(to);
    const sender = toStr(from || getCurrentUserId());

    if (!target || !sender) return;
    if (await isBlocked(target, sender)) return;

    if (isDND(target)) {
      await db.query(
        "INSERT INTO voicemails (user_id, from_id, audio_url) VALUES ($1, $2, $3)",
        [target, sender, url]
      );

      io.to(target).emit("voicemail:new", {
        from_id: sender,
        audio_url: url,
        timestamp: new Date().toISOString(),
        listened: 0,
      });

      return;
    }

    io.to(target).emit("message:audio", { from: sender, url });
  });
}
  // -------------------------------------------------------
  // Handle disconnect
  // -------------------------------------------------------
  socket.on("disconnect", () => {
    console.log("[socket] Disconnected:", socket.id);

    const uid = socket.userId;
    if (!uid) return;

    const becameOffline = removeOnlineSocket(uid, socket.id);

    if (becameOffline) {
      broadcastPresenceOffline(uid);
    }
  });
}); // <-- THIS closes io.on("connection")


// -------------------------------------------------------
// Start Server
// -------------------------------------------------------
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});











