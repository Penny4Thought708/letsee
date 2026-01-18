// -------------------------------------------------------
// server.js — Realtime Backend (WebRTC + Presence + Voicemail + Auth)
// Postgres / Neon version — Polished & Organized
// -------------------------------------------------------

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import WaveformData from "waveform-data";
import registerWebRTCHandlers from "./sockets/webrtc.js";
import { authMiddleware } from "./middleware/authMiddleware.js";

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

app.use("/auth", authRouter);
app.use("/auth", authMeRouter);

// -------------------------------------------------------
// Contacts API (inline version)
// -------------------------------------------------------
app.get("/api/contacts", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const contactsResult = await db.query(
      `SELECT 
         id AS contact_id,
         fullname AS contact_name,
         email AS contact_email,
         phone AS contact_phone,
         avatar_url AS contact_avatar,
         banner_url AS contact_banner,
         bio AS contact_bio,
         website AS contact_website,
         twitter AS contact_twitter,
         instagram AS contact_instagram,
         show_online AS contact_show_online,
         allow_messages AS contact_allow_messages
       FROM contacts
       WHERE owner_id = $1
       ORDER BY fullname ASC`,
      [userId]
    );

    const blockedResult = await db.query(
      `SELECT 
         b.blocked_id AS contact_id,
         u.fullname AS contact_name,
         u.email AS contact_email,
         u.avatar_url AS contact_avatar
       FROM blocked_contacts b
       JOIN users u ON u.id = b.blocked_id
       WHERE b.user_id = $1
       ORDER BY u.fullname ASC`,
      [userId]
    );

    res.json({
      contacts: contactsResult.rows || [],
      blocked: blockedResult.rows || []
    });

  } catch (err) {
    console.error("[contacts] DB error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// -------------------------------------------------------
// Messages API (inline version)
// -------------------------------------------------------
app.get("/api/messages/thread/:contactId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.contactId;

    const result = await db.query(
      `SELECT *
       FROM messages
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
      `INSERT INTO messages (sender_id, receiver_id, text)
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
// Voicemail API (inline version)
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
// Socket Connection
// -------------------------------------------------------
io.on("connection", (socket) => {
  console.log("[socket] Connected:", socket.id);

  let currentUserId = null;

  registerPresenceSync(socket);

  socket.on("session:init", ({ userId, fullname }) => {
    const uid = toStr(userId);
    if (!uid) return;

    currentUserId = uid;
    socket.userId = uid;
    socket.fullname = fullname || null;

    socket.join(uid);
    addOnlineUser(uid, socket.id, fullname || null);

    console.log(`[socket] REGISTERED userId=${uid} on socket=${socket.id}`);

    broadcastPresenceOnline(uid);
  });

  socket.on("register", (data = {}) => {
    if (!data || typeof data !== "object") {
      console.warn("[socket] register called with invalid payload:", data);
      return;
    }

    const { userId, fullname } = data;
    const uid = toStr(userId);

    if (!uid) {
      console.warn("[socket] register called without userId:", data);
      return;
    }

    currentUserId = uid;
    socket.userId = uid;
    socket.fullname = fullname || null;

    socket.join(uid);
    addOnlineUser(uid, socket.id, fullname || null);

    console.log(
      `[socket] REGISTERED (legacy) userId=${uid} on socket=${socket.id}`
    );

    broadcastPresenceOnline(uid);
  });

  socket.on("profile:update", (data) => {
    const userId = socket.userId;
    if (!userId) return;

    socket.broadcast.emit("profile:updated", {
      user_id: userId,
      ...data,
    });
  });

  socket.on("dnd:update", ({ userId, active }) => {
    const uid = toStr(userId || socket.userId);
    if (!uid) return;
    dndState.set(uid, !!active);
  });

  registerTypingAndRecording(socket, () => currentUserId);
  registerAudioMessaging(socket, () => currentUserId);

  registerWebRTCHandlers(io, socket, { isBlocked, isDND, db });

  socket.on("disconnect", () => {
    const uid = currentUserId || socket.userId || null;

    console.log(
      `[webrtc] Socket disconnected: ${socket.id} (userId=${uid || "unknown"})`
    );

    if (!uid) return;

    const lastSocketGone = removeOnlineSocket(uid, socket.id);
    if (lastSocketGone) {
      broadcastPresenceOffline(uid);
    } else {
      console.log(
        `[presence] Not marking offline; other active sockets exist for userId=${uid}`
      );
    }
  });
});

// -------------------------------------------------------
// PHP → WebSocket bridge
// -------------------------------------------------------
app.post("/profile-update", (req, res) => {
  io.emit("profile:updated", req.body);
  res.json({ success: true });
});

// -------------------------------------------------------
// ICE Server Route (Xirsys TURN/STUN)
// -------------------------------------------------------
app.get("/NewApp/get-ice", async (req, res) => {
  try {
    const response = await fetch("https://global.xirsys.net/_turn/MyFirstApp", {
      method: "PUT",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            "TommyYatts:91585c4a-ef29-11f0-a612-0242ac150002"
          ).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ format: "urls" }),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("ICE route error:", err);
    res.status(500).json({ error: "ice-failed" });
  }
});

// -------------------------------------------------------
// Self‑ping to keep Render awake
// -------------------------------------------------------
setInterval(() => {
  fetch("https://letsee-backend.onrender.com/health")
    .then(() => console.log("[ping] backend awake"))
    .catch(() => console.log("[ping] backend sleeping"));
}, 5 * 60 * 1000);

// -------------------------------------------------------
// Start server
// -------------------------------------------------------
const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Realtime server listening on port ${PORT}`);
});





















