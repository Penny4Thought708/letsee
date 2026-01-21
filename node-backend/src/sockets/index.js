// src/sockets/index.js
// Production‑grade real‑time orchestration layer

import registerPresence from "./presence.js";
import registerMessages from "./messages.js";
import registerTyping from "./typing.js";
import registerRecording from "./recording.js";
import registerVoicemail from "./voicemail.js";
import registerWebRTC from "./webrtc.js";

export default function registerSockets(io, db) {
  const onlineUsers = new Map();   // userId → { socketIds:Set, fullname, lastSeen, away }
  const dndState = new Map();
  const toStr = (v) => (v == null ? null : String(v));

  /* -------------------------------------------------------
     Logging Helper
  ------------------------------------------------------- */
  const log = (msg) => console.log(`[socket] ${msg}`);

  /* -------------------------------------------------------
     Presence Tracking
  ------------------------------------------------------- */
  function addOnlineUser(userId, socketId, fullname = null) {
    const key = toStr(userId);
    if (!key) return;

    let entry = onlineUsers.get(key);
    if (!entry) {
      entry = {
        socketIds: new Set(),
        fullname: fullname || null,
        lastSeen: Date.now(),
        away: false
      };
      onlineUsers.set(key, entry);
    }

    entry.socketIds.add(socketId);
    entry.lastSeen = Date.now();
    if (fullname) entry.fullname = fullname;
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

  function getSocketsForUser(userId) {
    const key = toStr(userId);
    const entry = onlineUsers.get(key);
    return entry ? [...entry.socketIds] : [];
  }
function getUserName(userId) {
  const entry = onlineUsers.get(String(userId));
  return entry?.fullname || null;
}
registerPresence(io, socket, onlineUsers, { getUserName });
registerMessages(io, socket, db, { isBlocked, isDND, getUserName });
registerTyping(io, socket, { isBlocked, isDND, getUserName });
registerRecording(io, socket, { isBlocked, isDND, getUserName });
registerVoicemail(io, socket, db, { getUserName });
registerWebRTC(io, socket, { isBlocked, isDND, getSocketsForUser, getUserName });

  /* -------------------------------------------------------
     Presence Broadcast Helpers
  ------------------------------------------------------- */
  function broadcastStatusUpdate(userId, { online, away }) {
    const idStr = toStr(userId);
    if (!idStr) return;

    io.emit("statusUpdate", {
      contact_id: idStr,
      online: !!online,
      away: !!away
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

  /* -------------------------------------------------------
     Block / DND Helpers
  ------------------------------------------------------- */
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

  /* -------------------------------------------------------
     Socket Connection
  ------------------------------------------------------- */
  io.on("connection", (socket) => {
    log(`Connected: ${socket.id}`);

    /* ---------------------------
       User Registration
    --------------------------- */
    socket.on("register", async (userId) => {
      if (!userId) {
        log(`⚠️ register event missing userId from socket ${socket.id}`);
        return;
      }

      socket.userId = userId;
      socket.join(`user:${userId}`);

      addOnlineUser(userId, socket.id);
      broadcastPresenceOnline(userId);

      log(`User ${userId} registered on socket ${socket.id}`);
    });

    /* ---------------------------
       DND Updates
    --------------------------- */
    socket.on("dnd:update", ({ userId, active }) => {
      if (!userId) return;

      dndState.set(toStr(userId), !!active);
      io.to(`user:${userId}`).emit("dnd:update", { active: !!active });

      log(`DND updated for user ${userId}: ${active}`);
    });

    /* ---------------------------
       Feature Modules
    --------------------------- */
    registerPresence(io, socket, onlineUsers);
    registerMessages(io, socket, db, { isBlocked, isDND });
    registerTyping(io, socket, { isBlocked, isDND });
    registerRecording(io, socket, { isBlocked, isDND });
    registerVoicemail(io, socket, db);

    // ⭐ WebRTC receives user → socket mapping
    registerWebRTC(io, socket, {
      isBlocked,
      isDND,
      getSocketsForUser
    });

    /* ---------------------------
       Disconnect Handling
    --------------------------- */
    socket.on("disconnect", () => {
      log(`Disconnected: ${socket.id}`);

      const uid = socket.userId;
      if (!uid) return;

      const becameOffline = removeOnlineSocket(uid, socket.id);
      if (becameOffline) {
        broadcastPresenceOffline(uid);
        log(`User ${uid} is now offline`);
      }
    });
  });
}





