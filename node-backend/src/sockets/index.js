import registerPresence from "./presence.js";
import registerMessages from "./messages.js";
import registerTyping from "./typing.js";
import registerRecording from "./recording.js";
import registerVoicemail from "./voicemail.js";
import registerWebRTC from "./webrtc.js";

export default function registerSockets(io, db) {
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
        away: false
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

    registerPresence(io, socket, onlineUsers);
    registerMessages(io, socket, db, { isBlocked, isDND });
    registerTyping(io, socket, { isBlocked, isDND });
    registerRecording(io, socket, { isBlocked, isDND });
    registerVoicemail(io, socket, db);
    registerWebRTC(io, socket);

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
}
