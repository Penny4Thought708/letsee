// src/sockets/webrtc.js
// Premium, production‑grade WebRTC signaling relay

// 🔥 Global call state (exported so index.js can use it for recovery)
export const activeCalls = new Map();
// key: userId
// value: { callerId, receiverId, status: "ringing" | "active" }

export default function registerWebRTC(io, socket, helpers = {}) {
  const {
    isBlocked,
    isDND,
    getSocketsForUser,
    getUserName
  } = helpers;

  /* -------------------------------------------------------
     Logging Helper
  ------------------------------------------------------- */
  const log = (...args) => console.log("[webrtc]", ...args);

  /* -------------------------------------------------------
     Core WebRTC Signaling Relay
     Handles: offer, answer, ice, end, busy, metadata
  ------------------------------------------------------- */
  socket.on("webrtc:signal", async (data = {}) => {
    const { type, to } = data;

    if (!type) {
      log(`⚠️ Missing 'type' from socket ${socket.id}`);
      return;
    }

    if (!to) {
      log(`⚠️ Missing 'to' for signal '${type}' from user ${socket.userId}`);
      return;
    }

    // Prevent echoing back to sender
    if (String(to) === String(socket.userId)) {
      log(`⚠️ Ignored self‑signal '${type}' from user ${socket.userId}`);
      return;
    }

    // 🔥 Track call state on offer
    if (type === "offer") {
      const callerId = socket.userId;
      const receiverId = to;

      activeCalls.set(callerId, {
        callerId,
        receiverId,
        status: "ringing"
      });

      activeCalls.set(receiverId, {
        callerId,
        receiverId,
        status: "ringing"
      });

      log(`📞 Stored call state: ${callerId} → ${receiverId} (ringing)`);
    }

    // 🔥 Mark call active on answer
    if (type === "answer") {
      const call = activeCalls.get(socket.userId);
      if (call) {
        call.status = "active";
        activeCalls.set(call.callerId, call);
        activeCalls.set(call.receiverId, call);
        log(`✅ Call active between ${call.callerId} ↔ ${call.receiverId}`);
      }
    }

    // Block check
    if (isBlocked && await isBlocked(to, socket.userId)) {
      log(`🚫 Blocked: user ${socket.userId} → user ${to} (${type})`);
      return;
    }

    // DND check
    if (isDND && isDND(to)) {
      log(`🚫 DND: user ${to} is in Do Not Disturb`);
      io.to(`user:${socket.userId}`).emit("call:dnd", { from: to });
      return;
    }

    // Multi‑device routing
    const targets = getSocketsForUser?.(to) || [];
    if (targets.length === 0) {
      log(`⚠️ No active sockets for user ${to} (signal '${type}')`);
      return;
    }

    for (const sid of targets) {
      io.to(sid).emit("webrtc:signal", {
        ...data,
        from: socket.userId
      });
    }

    log(
      `📡 Relayed '${type}' from user ${socket.userId} → user ${to} (${targets.length} devices)`
    );
  });

  /* -------------------------------------------------------
     Call End
  ------------------------------------------------------- */
  socket.on("call:end", ({ to } = {}) => {
    if (!to) {
      log(`⚠️ call:end missing 'to' from user ${socket.userId}`);
      return;
    }

    const targets = getSocketsForUser?.(to) || [];
    for (const sid of targets) {
      io.to(sid).emit("call:end", { from: socket.userId });
    }

    // 🔥 Clear call state for both sides
    const callerId = socket.userId;
    const receiverId = to;

    activeCalls.delete(callerId);
    activeCalls.delete(receiverId);

    log(`📞 call:end from user ${callerId} → user ${receiverId} (state cleared)`);
  });

  /* -------------------------------------------------------
     Busy / DND / Voicemail Hooks
  ------------------------------------------------------- */
  socket.on("call:busy", ({ to } = {}) => {
    if (!to) return;

    const targets = getSocketsForUser?.(to) || [];
    for (const sid of targets) {
      io.to(sid).emit("call:busy", { from: socket.userId });
    }

    log(`⛔ call:busy from user ${socket.userId} → user ${to}`);
  });

  socket.on("call:dnd", ({ to } = {}) => {
    if (!to) return;

    const targets = getSocketsForUser?.(to) || [];
    for (const sid of targets) {
      io.to(sid).emit("call:dnd", { from: socket.userId });
    }

    log(`🔕 call:dnd from user ${socket.userId} → user ${to}`);
  });

  socket.on("call:voicemail", ({ to, reason } = {}) => {
    if (!to) return;

    const targets = getSocketsForUser?.(to) || [];
    for (const sid of targets) {
      io.to(sid).emit("call:voicemail", {
        from: socket.userId,
        reason: reason || "unknown"
      });
    }

    log(`📨 call:voicemail from user ${socket.userId} → user ${to}`);
  });

  /* -------------------------------------------------------
     Cleanup
  ------------------------------------------------------- */
  socket.on("disconnect", () => {
    log(`Socket disconnected: ${socket.id} (user ${socket.userId || "?"})`);
  });
}





