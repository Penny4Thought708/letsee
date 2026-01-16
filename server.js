// -------------------------------------------------------
// server.js — Modular Realtime Backend (WebRTC + Presence + Voicemail)
// Postgres / Neon version
// -------------------------------------------------------

import express from "express";
import http from "http";
import { Server } from "socket.io";

import cors from "cors";
import cookieParser from "cookie-parser";   // ⭐ REQUIRED FOR req.cookies
import WaveformData from "waveform-data";
import fs from "fs";

import registerWebRTCHandlers from "./sockets/webrtc.js";

// -------------------------------------------------------
// Database (Postgres / Neon)
// -------------------------------------------------------
import pkg from "pg";
const { Pool } = pkg;

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
// CORS (must allow GitHub Pages + Render + localhost)
// -------------------------------------------------------
const allowedOrigins = [
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",

  "https://1r8lbgk7-80.use.devtunnels.ms",
  "https://efficient-prefer-rules-lead.trycloudflare.com",

  "https://letsee-vv23.onrender.com",
  "https://letsee-backend.onrender.com",

  // ⭐ REQUIRED FOR GitHub Pages
  "https://penny4thought708.github.io",
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(cookieParser());   // ⭐ MUST COME BEFORE ROUTES

// -------------------------------------------------------
// Auth Routes
// -------------------------------------------------------
import authRouter from "./auth/login.js";
app.use("/auth", authRouter);

// -------------------------------------------------------
// Socket.IO
// -------------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// -------------------------------------------------------
// Presence / DND state
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
// Presence sync
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
// Typing + recording
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
// Audio messaging + voicemail
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
// Socket connection
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

  socket.on("register", ({ userId, fullname }) => {
    const uid = toStr(userId);
    if (!uid) return;

    currentUserId = uid;
    socket.userId = uid;
    socket.fullname = fullname || null;

    socket.join(uid);
    addOnlineUser(uid, socket.id, fullname || null);

    console.log(`[socket] REGISTERED (legacy) userId=${uid} on socket=${socket.id}`);

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

    console.log(`[webrtc] Socket disconnected: ${socket.id} (userId=${uid || "unknown"})`);

    if (!uid) return;

    const lastSocketGone = removeOnlineSocket(uid, socket.id);
    if (lastSocketGone) {
      broadcastPresenceOffline(uid);
    } else {
      console.log(`[presence] Not marking offline; other active sockets exist for userId=${uid}`);
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
// Voicemail list API
// -------------------------------------------------------
app.get("/api/voicemail/list", async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const result = await db.query(
      `SELECT id, user_id, from_id, audio_url, transcript, peaks_json, created_at, listened
       FROM voicemails
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 100`,
      [userId]
    );

    res.json({ voicemails: result.rows || [] });
  } catch (err) {
    console.error("[voicemail] Error loading list:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// -------------------------------------------------------
// Call logs API
// -------------------------------------------------------
app.get("/api/call-logs", async (req, res) => {
  try {
    const offset = parseInt(req.query.offset || "0", 10);
    const limit = parseInt(req.query.limit || "30", 10);

    const result = await db.query(
      `SELECT * FROM call_logs ORDER BY id DESC LIMIT $1 OFFSET $2`,
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
// Start server
// -------------------------------------------------------
const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Realtime server listening on port ${PORT}`);
});













