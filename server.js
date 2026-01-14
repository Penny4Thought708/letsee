// -------------------------------------------------------
// server.js — Clean, Modular + Profile Updates
// -------------------------------------------------------

import express from "express";
import http from "http";
import { Server } from "socket.io";
import mysql from "mysql2/promise";
import cors from "cors";
import fs from "fs";
import WaveformData from "waveform-data";

import registerWebRTCHandlers from "./sockets/webrtc.js";

// -------------------------------------------------------
// Database
// -------------------------------------------------------
const db = await mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "scrubbers_db",
});

// -------------------------------------------------------
// Express + HTTP + Socket.IO
// -------------------------------------------------------
const app = express()
app.use(express.json());

const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:3001",
  "https://efficient-prefer-rules-lead.trycloudflare.com"
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// -------------------------------------------------------
// Presence / DND state
// -------------------------------------------------------
// onlineUsers: userId -> { socketIds: Set<string>, fullname: string|null, lastSeen: number, away: boolean }
const onlineUsers = new Map();
const dndState = new Map(); // userId -> boolean

const toStr = (v) => (v == null ? null : String(v));

// Helpers for onlineUsers
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
  if (fullname) {
    entry.fullname = fullname;
  }
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
    return true; // last socket gone
  }

  return false; // still has other sockets
}

// -------------------------------------------------------
// Presence broadcast helpers
// -------------------------------------------------------
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

  // For new PresenceClient.js
  broadcastStatusUpdate(idStr, { online: true, away: false });

  // For webrtc.js presence listeners
  io.emit("presence:online", { user_id: idStr });
}

function broadcastPresenceOffline(userId) {
  const idStr = toStr(userId);
  if (!idStr) return;

  console.log(`[presence] User offline: userId=${idStr}`);

  // For new PresenceClient.js
  broadcastStatusUpdate(idStr, { online: false, away: false });

  // For webrtc.js presence listeners
  io.emit("presence:offline", { user_id: idStr });
}

// -------------------------------------------------------
// Blocking helper
// -------------------------------------------------------
async function isBlocked(receiverId, senderId) {
  const [rows] = await db.query(
    "SELECT 1 FROM blocked_contacts WHERE user_id = ? AND blocked_id = ? LIMIT 1",
    [receiverId, senderId]
  );
  return rows.length > 0;
}

// -------------------------------------------------------
// DND helper
// -------------------------------------------------------
function isDND(userId) {
  return dndState.get(toStr(userId)) === true;
}

// -------------------------------------------------------
// Presence sync for PresenceClient.js
// -------------------------------------------------------
function registerPresenceSync(socket) {
  // PresenceClient currently calls presence:get and expects statusBatch
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
// Typing + recording events
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

    // sockets join rooms named by userId
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
// Audio messaging + voicemail routing
// -------------------------------------------------------
function registerAudioMessaging(socket, getCurrentUserId) {
  socket.on("message:audio", async ({ from, to, url }) => {
    const target = toStr(to);
    const sender = toStr(from || getCurrentUserId());

    if (!target || !sender) return;
    if (await isBlocked(target, sender)) return;

    if (isDND(target)) {
      // Save as voicemail
      await db.query(
        "INSERT INTO voicemails (user_id, from_id, audio_url) VALUES (?, ?, ?)",
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

  // Presence list support (for PresenceClient.js)
  registerPresenceSync(socket);

  // FRONTEND REGISTRATION (new presence client)
  // PresenceClient emits: socket.emit("session:init", { userId })
  socket.on("session:init", ({ userId, fullname }) => {
    const uid = toStr(userId);
    if (!uid) {
      console.warn("[socket] session:init with invalid userId:", userId);
      return;
    }

    currentUserId = uid;
    socket.userId = uid;
    socket.fullname = fullname || null;

    // Join room based on userId (for direct events)
    socket.join(uid);

    addOnlineUser(uid, socket.id, fullname || null);

    console.log(
      `[socket] REGISTERED userId=${uid} on socket=${socket.id}`
    );

    broadcastPresenceOnline(uid);
  });

  // LEGACY REGISTRATION SUPPORT (if any old clients still use 'register')
  socket.on("register", ({ userId, fullname }) => {
    const uid = toStr(userId);
    if (!uid) return;

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

  // REAL-TIME PROFILE UPDATE (from client JS)
  socket.on("profile:update", (data) => {
    const userId = socket.userId;
    if (!userId) return;

    socket.broadcast.emit("profile:updated", {
      user_id: userId,
      ...data,
    });
  });

  // DND toggle
  socket.on("dnd:update", ({ userId, active }) => {
    const uid = toStr(userId || socket.userId);
    if (!uid) return;
    dndState.set(uid, !!active);
  });

  // Typing + recording
  registerTypingAndRecording(socket, () => currentUserId);

  // Audio messaging
  registerAudioMessaging(socket, () => currentUserId);

  // WebRTC signaling + presence hooks
  registerWebRTCHandlers(io, socket, { isBlocked, isDND, db });

  // Disconnect
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
// PHP → WebSocket bridge for profile updates
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

    const [rows] = await db.query(
      `SELECT id, user_id, from_id, audio_url, transcript, peaks_json, created_at, listened
       FROM voicemails
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 100`,
      [userId]
    );

    res.json({ voicemails: rows || [] });
  } catch (err) {
    console.error("[voicemail] Error loading list:", err);
    res.status(500).json({ error: "Database error" });
  }
});
// -------------------------------------------------------
// Call Log: Fetch enriched row (same shape as load.php)
// -------------------------------------------------------
async function getEnrichedCallLog(db, logId, viewerId) {
  const [rows] = await db.query(
    `
    SELECT 
      cl.id,
      cl.caller_id,
      cl.receiver_id,
      cl.call_type,
      cl.status,
      cl.duration,
      cl.timestamp,

      uc.fullname AS caller_name,
      uc.avatar   AS caller_avatar,

      ur.fullname AS receiver_name,
      ur.avatar   AS receiver_avatar,

      CASE
        WHEN cl.caller_id = ? THEN 'outgoing'
        ELSE 'incoming'
      END AS direction,

      CASE
        WHEN cl.caller_id = ? THEN cl.receiver_id
        ELSE cl.caller_id
      END AS other_party_id,

      (
        SELECT pm.message
        FROM private_messages pm
        WHERE 
          (
            pm.sender_id = ? 
            AND pm.receiver_id = 
              CASE WHEN cl.caller_id = ? THEN cl.receiver_id ELSE cl.caller_id END
          )
          OR
          (
            pm.sender_id = 
              CASE WHEN cl.caller_id = ? THEN cl.receiver_id ELSE cl.caller_id END
            AND pm.receiver_id = ?
          )
        ORDER BY pm.created_at DESC
        LIMIT 1
      ) AS last_message,

      (
        SELECT pm.created_at
        FROM private_messages pm
        WHERE 
          (
            pm.sender_id = ? 
            AND pm.receiver_id = 
              CASE WHEN cl.caller_id = ? THEN cl.receiver_id ELSE cl.caller_id END
          )
          OR
          (
            pm.sender_id = 
              CASE WHEN cl.caller_id = ? THEN cl.receiver_id ELSE cl.caller_id END
            AND pm.receiver_id = ?
          )
        ORDER BY pm.created_at DESC
        LIMIT 1
      ) AS last_message_time,

      (
        SELECT pm.sender_id
        FROM private_messages pm
        WHERE 
          (
            pm.sender_id = ? 
            AND pm.receiver_id = 
              CASE WHEN cl.caller_id = ? THEN cl.receiver_id ELSE cl.caller_id END
          )
          OR
          (
            pm.sender_id = 
              CASE WHEN cl.caller_id = ? THEN cl.receiver_id ELSE cl.caller_id END
            AND pm.receiver_id = ?
          )
        ORDER BY pm.created_at DESC
        LIMIT 1
      ) AS last_message_sender_id

    FROM call_logs cl
    LEFT JOIN users uc ON cl.caller_id = uc.user_id
    LEFT JOIN users ur ON cl.receiver_id = ur.user_id
    WHERE cl.id = ?
    LIMIT 1
    `,
    [
      viewerId, viewerId,
      viewerId, viewerId, viewerId, viewerId,
      viewerId, viewerId, viewerId, viewerId,
      viewerId, viewerId, viewerId, viewerId,
      logId
    ]
  );

  return rows[0] || null;
}

// -------------------------------------------------------
// PHP → Node: New Call Log Created
// -------------------------------------------------------
app.post("/call-log/new", async (req, res) => {
  try {
    const { id, userId } = req.body;

    if (!id || !userId) {
      return res.status(400).json({ error: "Missing id or userId" });
    }

    // Fetch enriched row for the user who created it
    const log = await getEnrichedCallLog(db, id, userId);
    if (!log) {
      return res.status(404).json({ error: "Log not found" });
    }

    // Emit to caller and receiver
    io.to(String(log.caller_id)).emit("call:log:add", log);
    io.to(String(log.receiver_id)).emit("call:log:add", log);

    res.json({ success: true });
  } catch (err) {
    console.error("[call-log:new] Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// -------------------------------------------------------
// Call logs API
// -------------------------------------------------------
app.get("/api/call-logs", async (req, res) => {
  try {
    const offset = parseInt(req.query.offset || "0", 10);
    const limit = parseInt(req.query.limit || "30", 10);

    const [rows] = await db.query(
      `SELECT * FROM call_logs ORDER BY id DESC LIMIT ?, ?`,
      [offset, limit]
    );

    res.json({
      logs: rows,
      hasMore: rows.length === limit,
    });
  } catch (err) {
    console.error("[call-logs] DB error:", err);
    res.status(500).json({ error: "Database error" });
  }
});


// -------------------------------------------------------
// Start server (must listen on 0.0.0.0 for ngrok)
// -------------------------------------------------------
const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Realtime server listening on port ${PORT}`);
});

