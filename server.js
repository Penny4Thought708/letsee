// -------------------------------------------------------
// server.js — WebRTC Signaling Only (Render Compatible)
// -------------------------------------------------------

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

// -------------------------------------------------------
// Express + HTTP + Socket.IO
// -------------------------------------------------------
const app = express();
app.use(express.json());

const server = http.createServer(app);

const allowedOrigins = [
  // Local development
  "http://localhost", "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1", "http://127.0.0.1:3000", "http://127.0.0.1:3001",

  // Dev Tunnels
  "https://1r8lbgk7-80.use.devtunnels.ms",

  // Render frontend
  "https://letsee-vv23.onrender.com",

  // Render backend (signaling server)
  "https://letsee-vv23.onrender.com"
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
const onlineUsers = new Map(); // userId -> { socketIds: Set, fullname, away }
const dndState = new Map();    // userId -> boolean

const toStr = (v) => (v == null ? null : String(v));

// -------------------------------------------------------
// Presence helpers
// -------------------------------------------------------
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
  io.emit("statusUpdate", {
    contact_id: String(userId),
    online: !!online,
    away: !!away,
  });
}

function broadcastPresenceOnline(userId) {
  broadcastStatusUpdate(userId, { online: true, away: false });
  io.emit("presence:online", { user_id: String(userId) });
}

function broadcastPresenceOffline(userId) {
  broadcastStatusUpdate(userId, { online: false, away: false });
  io.emit("presence:offline", { user_id: String(userId) });
}

// -------------------------------------------------------
// Socket connection
// -------------------------------------------------------
io.on("connection", (socket) => {
  console.log("[socket] Connected:", socket.id);

  let currentUserId = null;

  // Presence sync
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

  // Registration
  socket.on("session:init", ({ userId, fullname }) => {
    const uid = toStr(userId);
    if (!uid) return;

    currentUserId = uid;
    socket.userId = uid;
    socket.fullname = fullname || null;

    socket.join(uid);
    addOnlineUser(uid, socket.id, fullname || null);

    console.log(`[socket] REGISTERED userId=${uid} socket=${socket.id}`);
    broadcastPresenceOnline(uid);
  });

  // Typing
  socket.on("typing:start", ({ from, to }) => {
    io.to(String(to)).emit("typing:start", { from: String(from) });
  });

  socket.on("typing:stop", ({ from, to }) => {
    io.to(String(to)).emit("typing:stop", { from: String(from) });
  });

  // DND
  socket.on("dnd:update", ({ userId, active }) => {
    const uid = toStr(userId || socket.userId);
    if (!uid) return;
    dndState.set(uid, !!active);
  });

  // WebRTC signaling
  socket.on("webrtc:offer", ({ to, from, offer }) => {
    io.to(String(to)).emit("webrtc:offer", { from, offer });
  });

  socket.on("webrtc:answer", ({ to, from, answer }) => {
    io.to(String(to)).emit("webrtc:answer", { from, answer });
  });

  socket.on("webrtc:ice", ({ to, from, candidate }) => {
    io.to(String(to)).emit("webrtc:ice", { from, candidate });
  });

  // Disconnect
  socket.on("disconnect", () => {
    const uid = currentUserId || socket.userId;
    console.log(`[socket] Disconnected: ${socket.id} userId=${uid}`);

    if (!uid) return;

    const lastSocketGone = removeOnlineSocket(uid, socket.id);
    if (lastSocketGone) {
      broadcastPresenceOffline(uid);
    }
  });
});

// -------------------------------------------------------
// Start server
// -------------------------------------------------------
const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Signaling server running on port ${PORT}`);
});



