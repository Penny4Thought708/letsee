// node-backend/src/sockets/webrtc.js
// -------------------------------------------------------
// Premium, production‑grade WebRTC signaling relay
// With call state, timeout, decline → voicemail, missed → voicemail
// -------------------------------------------------------

// 🔥 Global call state (exported so index.js can use it for recovery)
export const activeCalls = new Map();
// key: userId
// value: { callerId, receiverId, status: "ringing" | "active" | "ended", timeout? }

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

    const callerId = socket.userId;
    const receiverId = to;

    // 🔥 Track call state + timeout on offer
    if (type === "offer") {
      // Clear any stale state for these users
      activeCalls.delete(callerId);
      activeCalls.delete(receiverId);

      // Auto-timeout → voicemail after 25 seconds of ringing
      const timeout = setTimeout(() => {
        const call = activeCalls.get(callerId);
        // Only fire timeout if call is still ringing
        if (!call || call.status !== "ringing") {
          return;
        }

        log(`⏳ Call timeout: ${callerId} → ${receiverId}`);

        io.to(`user:${callerId}`).emit("call:timeout", { from: receiverId });
        io.to(`user:${callerId}`).emit("call:voicemail", {
          from: receiverId,
          reason: "timeout"
        });

        activeCalls.delete(callerId);
        activeCalls.delete(receiverId);
      }, 25000);

      const callState = {
        callerId,
        receiverId,
        status: "ringing",
        timeout
      };

      activeCalls.set(callerId, callState);
      activeCalls.set(receiverId, callState);

      log(`📞 Stored call state: ${callerId} → ${receiverId} (ringing)`);
    }

    // 🔥 Mark call active on answer + clear timeout (backup to call:accept)
    if (type === "answer") {
      const call = activeCalls.get(socket.userId);
      if (call) {
        if (call.timeout) {
          clearTimeout(call.timeout);
          call.timeout = null;
        }
        call.status = "active";
        activeCalls.set(call.callerId, call);
        activeCalls.set(call.receiverId, call);
        log(`✅ Call active between ${call.callerId} ↔ ${call.receiverId} (via answer)`);
      }
    }

    // 🔥 Handle end sent via webrtc:signal (frontend uses this)
    if (type === "end") {
      const call =
        activeCalls.get(callerId) ||
        activeCalls.get(receiverId);

      if (call && call.timeout) {
        clearTimeout(call.timeout);
      }

      activeCalls.delete(call?.callerId);
      activeCalls.delete(call?.receiverId);

      log(`📞 webrtc:signal 'end' from ${callerId} → ${receiverId} (state cleared)`);
      // Relay to other side happens below as usual
    }

    // Block check
    if (isBlocked && await isBlocked(to, socket.userId)) {
      log(`🚫 Blocked: user ${socket.userId} → user ${to} (${type})`);
      return;
    }

    // DND check → immediate voicemail
    if (isDND && isDND(to)) {
      log(`🔕 DND: user ${to} is in Do Not Disturb`);

      io.to(`user:${socket.userId}`).emit("call:dnd", { from: to });
      io.to(`user:${socket.userId}`).emit("call:voicemail", {
        from: to,
        reason: "dnd"
      });

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
     Explicit Call Accept (from frontend)
     Used by WebRTCController.answerIncomingCall()
  ------------------------------------------------------- */
  socket.on("call:accept", ({ to } = {}) => {
    if (!to) {
      log(`⚠️ call:accept missing 'to' from user ${socket.userId}`);
      return;
    }

    const accepterId = socket.userId;
    const otherId = to;

    const call =
      activeCalls.get(accepterId) ||
      activeCalls.get(otherId);

    if (!call) {
      log(`❌ call:accept with no active ringing call for ${accepterId}`);
      return;
    }

    if (call.timeout) {
      clearTimeout(call.timeout);
      call.timeout = null;
    }

    call.status = "active";
    activeCalls.set(call.callerId, call);
    activeCalls.set(call.receiverId, call);

    log(`✅ Call active between ${call.callerId} ↔ ${call.receiverId} (via call:accept)`);
  });

  /* -------------------------------------------------------
     Call End (legacy path, if used)
  ------------------------------------------------------- */
  socket.on("call:end", ({ to } = {}) => {
    if (!to) {
      log(`⚠️ call:end missing 'to' from user ${socket.userId}`);
      return;
    }

    const callerId = socket.userId;
    const receiverId = to;

    const call =
      activeCalls.get(callerId) ||
      activeCalls.get(receiverId);

    if (call && call.timeout) {
      clearTimeout(call.timeout);
    }

    const targets = getSocketsForUser?.(to) || [];
    for (const sid of targets) {
      io.to(sid).emit("call:end", { from: socket.userId });
    }

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
     Decline → Voicemail
  ------------------------------------------------------- */
  socket.on("call:decline", ({ to } = {}) => {
    if (!to) return;

    const declinerId = socket.userId;
    const otherId = to;

    const call =
      activeCalls.get(declinerId) ||
      activeCalls.get(otherId);

    if (!call) {
      log(`❌ call:decline with no active call for ${declinerId}`);
      return;
    }

    if (call.timeout) {
      clearTimeout(call.timeout);
      call.timeout = null;
    }

    log(`❌ Call declined: ${declinerId} → ${otherId}`);

    // Notify caller (whoever is not the decliner)
    const callerId = call.callerId;
    const receiverId = call.receiverId;
    const notifyId = declinerId === callerId ? receiverId : callerId;

    io.to(`user:${notifyId}`).emit("call:declined", { from: declinerId });
    io.to(`user:${notifyId}`).emit("call:voicemail", {
      from: declinerId,
      reason: "declined"
    });

    activeCalls.delete(call.callerId);
    activeCalls.delete(call.receiverId);
  });

  /* -------------------------------------------------------
     Cleanup / Missed Call → Voicemail
  ------------------------------------------------------- */
  socket.on("disconnect", () => {
    log(`Socket disconnected: ${socket.id} (user ${socket.userId || "?"})`);

    const userId = socket.userId;
    if (!userId) return;

    for (const [key, call] of activeCalls.entries()) {
      if (call.callerId === userId || call.receiverId === userId) {
        const { callerId, receiverId, status, timeout } = call;

        if (timeout) clearTimeout(timeout);

        // If the receiver disappears while ringing → missed call → voicemail
        if (receiverId === userId && status === "ringing") {
          log(`📵 Missed call: ${callerId} → ${receiverId}`);

          io.to(`user:${callerId}`).emit("call:missed", { from: receiverId });
          io.to(`user:${callerId}`).emit("call:voicemail", {
            from: receiverId,
            reason: "missed"
          });
        }

        activeCalls.delete(callerId);
        activeCalls.delete(receiverId);
      }
    }
  });
}








