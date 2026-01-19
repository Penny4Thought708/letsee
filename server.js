// server.js — Unified Realtime Backend (Auth + Messages + Voicemail + Contacts + Call Logs + WebRTC)
// Uses Postgres "messages" table (M1)

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import pkg from "pg";
import path from "path";
import multer from "multer";
import jwt from "jsonwebtoken";

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

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.sendStatus(200);
});

app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// -------------------------------------------------------
// Auth Middleware
// -------------------------------------------------------
function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { user_id: decoded.user_id };
    next();
  } catch {
    return res.status(401).json({ success: false });
  }
}

// -------------------------------------------------------
// Health Route
// -------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// -------------------------------------------------------
// Auth Routes
// -------------------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  const { email } = req.body;
  try {
    const { rows } = await db.query(
      "SELECT user_id, fullname, email, avatar FROM users WHERE email=$1 LIMIT 1",
      [email]
    );
    if (!rows[0]) return res.status(401).json({ success: false });

    const user = rows[0];
    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });

    res.json({ success: true, user });
  } catch (err) {
    console.error("[auth/login] error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.json({ success: false });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await db.query(
      "SELECT user_id, fullname, email, avatar FROM users WHERE user_id=$1",
      [decoded.user_id]
    );

    if (!rows[0]) return res.json({ success: false });

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------
// Contacts API
// -------------------------------------------------------
app.get("/api/contacts", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const { rows } = await db.query(
      `
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
      `,
      [userId]
    );

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
          ? `uploads/avatars/${row.avatar_filename}`
          : `img/defaultUser.png`,
        contact_phone: row.contact_phone,
        contact_bio: row.contact_bio,
        contact_banner: row.contact_banner
          ? `uploads/banners/${row.contact_banner}`
          : `img/profile-banner.jpg`,
        is_favorite: row.is_favorite,
        added_on: row.added_on,
        online: false,
        last_message: last.message || null,
        last_message_at: last.created_at || null,
        unread_count: Number(last.unread_count || 0),
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
// Messages API (M1: messages table)
// -------------------------------------------------------
app.get("/api/messages/list", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const { rows } = await db.query(
      `
      SELECT DISTINCT ON (contact_id)
        contact_id,
        contact_name,
        contact_avatar,
        last_message,
        last_message_at
      FROM message_threads
      WHERE user_id=$1
      ORDER BY contact_id, last_message_at DESC
      `,
      [userId]
    );

    res.json({ success: true, threads: rows });
  } catch (err) {
    console.error("[messages/list] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

app.get("/api/messages/thread/:contactId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const contactId = req.params.contactId;

    const { rows } = await db.query(
      `
      SELECT *
      FROM messages
      WHERE 
        (sender_id=$1 AND receiver_id=$2)
        OR
        (sender_id=$2 AND receiver_id=$1)
      ORDER BY created_at ASC
      `,
      [userId, contactId]
    );

    await db.query(
      `UPDATE messages SET seen=1 WHERE receiver_id=$1 AND sender_id=$2`,
      [userId, contactId]
    );

    res.json({ success: true, messages: rows });
  } catch (err) {
    console.error("[messages/thread] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

const upload = multer({ dest: "uploads/" });

app.post("/api/messages/audio", authMiddleware, upload.single("audio"), (req, res) => {
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

app.post("/api/messages/send", authMiddleware, async (req, res) => {
  try {
    const senderId = req.user.user_id;
    const { receiver_id, message, file, file_url } = req.body;

    const { rows } = await db.query(
      `
      INSERT INTO messages (sender_id, receiver_id, message, file, file_url)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [senderId, receiver_id, message || "", file || 0, file_url || null]
    );

    const msg = rows[0];

    io.to(`user:${receiver_id}`).emit("message:new", msg);
    io.to(`user:${senderId}`).emit("message:new", msg);

    res.json({ success: true, ...msg });
  } catch (err) {
    console.error("[messages/send] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

// -------------------------------------------------------
// Voicemail API
// -------------------------------------------------------
app.get("/api/voicemail/list", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await db.query(
      `SELECT id, user_id, from_id, audio_url, transcript, peaks_json, created_at, listened
       FROM voicemails
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 100`,
      [userId]
    );

    res.json({ success: true, voicemails: result.rows });
  } catch (err) {
    console.error("[voicemail/list] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

app.post("/api/voicemail/save", authMiddleware, async (req, res) => {
  try {
    const { userId, fromId, audioUrl } = req.body;

    const { rows } = await db.query(
      `
      INSERT INTO voicemails (user_id, from_id, audio_url)
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [userId, fromId, audioUrl]
    );

    const vm = rows[0];

    io.to(`user:${userId}`).emit("voicemail:new", vm);

    res.json({ success: true, voicemail: vm });
  } catch (err) {
    console.error("[voicemail/save] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

app.post("/api/voicemail/delete", authMiddleware, async (req, res) => {
  try {
    const { id } = req.body;

    await db.query(`DELETE FROM voicemails WHERE id=$1`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("[voicemail/delete] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

app.post("/api/voicemail/listened", authMiddleware, async (req, res) => {
  try {
    const { id } = req.body;

    await db.query(`UPDATE voicemails SET listened=1 WHERE id=$1`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("[voicemail/listened] error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

// -------------------------------------------------------
// Call Logs API
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
    console.error("[call-logs] error:", err);
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

// Presence / DND
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

  broadcastStatusUpdate(idStr, { online: true, away: false });
  io.emit("presence:online", { user_id: idStr });
}

function broadcastPresenceOffline(userId) {
  const idStr = toStr(userId);
  if (!idStr) return;

  broadcastStatusUpdate(idStr, { online: false, away: false });
  io.emit("presence:offline", { user_id: idStr });
}

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

  socket.on("register", async (userId) => {
    socket.userId = userId;
    socket.join(`user:${userId}`);

    addOnlineUser(userId, socket.id);
    broadcastPresenceOnline(userId);
  });

  socket.on("dnd:update", ({ userId, active }) => {
    dndState.set(toStr(userId), !!active);
    io.to(`user:${userId}`).emit("dnd:update", { active: !!active });
  });

  socket.on("typing:start", async ({ from, to }) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);
    if (!sender || !target) return;
    if (await isBlocked(target, sender)) return;
    if (isDND(target)) return;

    io.to(`user:${target}`).emit("typing:start", { from: sender });
  });

  socket.on("typing:stop", async ({ from, to }) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);
    if (!sender || !target) return;
    if (await isBlocked(target, sender)) return;
    if (isDND(target)) return;

    io.to(`user:${target}`).emit("typing:stop", { from: sender });
  });

  socket.on("message:audio", async ({ from, to, url }) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);
    if (!sender || !target) return;
    if (await isBlocked(target, sender)) return;

    if (isDND(target)) {
      await db.query(
        "INSERT INTO voicemails (user_id, from_id, audio_url) VALUES ($1, $2, $3)",
        [target, sender, url]
      );

      io.to(`user:${target}`).emit("voicemail:new", {
        from_id: sender,
        audio_url: url,
        timestamp: new Date().toISOString(),
        listened: 0,
      });

      return;
    }

    io.to(`user:${target}`).emit("message:audio", { from: sender, url });
    io.to(`user:${sender}`).emit("message:audio", { from: sender, url });
  });

  socket.on("call:start", ({ to }) => {
    io.to(`user:${to}`).emit("call:start");
  });

  socket.on("disconnect", () => {
    console.log("[socket] Disconnected:", socket.id);
    const uid = socket.userId;
    if (!uid) return;

    const becameOffline = removeOnlineSocket(uid, socket.id);
    if (becameOffline) {
      broadcastPresenceOffline(uid);
    }
  });
});

// -------------------------------------------------------
// Start Server
// -------------------------------------------------------
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});






















