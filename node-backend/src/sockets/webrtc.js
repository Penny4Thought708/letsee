// src/sockets/webrtc.js
// Production‑grade WebRTC signaling relay

export default function registerWebRTC(io, socket) {
  /* -------------------------------------------------------
     Helper: Safe logging
  ------------------------------------------------------- */
  function log(msg) {
    console.log(`[webrtc] ${msg}`);
  }

  /* -------------------------------------------------------
     Core WebRTC signaling relay
     Handles: offer, answer, ice, end, busy, metadata
  ------------------------------------------------------- */
  socket.on("webrtc:signal", (data = {}) => {
    const { type, to } = data;

    if (!type) {
      log(`⚠️ Missing 'type' in signal from socket ${socket.id}`);
      return;
    }

    if (!to) {
      log(`⚠️ Missing 'to' in signal '${type}' from user ${socket.userId}`);
      return;
    }

    // Prevent echoing back to sender
    if (to === socket.userId) {
      log(`⚠️ Ignored self‑signal '${type}' from user ${socket.userId}`);
      return;
    }

    // Relay to all devices for that user
    io.to(`user:${to}`).emit("webrtc:signal", {
      ...data,
      from: socket.userId
    });

    log(`Relayed '${type}' from user ${socket.userId} → user ${to}`);
  });

  /* -------------------------------------------------------
     Call End (shortcut event)
  ------------------------------------------------------- */
  socket.on("call:end", ({ to } = {}) => {
    if (!to) {
      log(`⚠️ call:end missing 'to' from user ${socket.userId}`);
      return;
    }

    io.to(`user:${to}`).emit("call:end", {
      from: socket.userId
    });

    log(`call:end from user ${socket.userId} → user ${to}`);
  });

  /* -------------------------------------------------------
     Busy / DND / Voicemail Hooks (optional)
     These events allow the frontend to show:
     - "User is busy"
     - "User is in Do Not Disturb"
     - "Leave a voicemail"
  ------------------------------------------------------- */
  socket.on("call:busy", ({ to } = {}) => {
    if (!to) return;

    io.to(`user:${to}`).emit("call:busy", {
      from: socket.userId
    });

    log(`call:busy from user ${socket.userId} → user ${to}`);
  });

  socket.on("call:dnd", ({ to } = {}) => {
    if (!to) return;

    io.to(`user:${to}`).emit("call:dnd", {
      from: socket.userId
    });

    log(`call:dnd from user ${socket.userId} → user ${to}`);
  });

  socket.on("call:voicemail", ({ to, reason } = {}) => {
    if (!to) return;

    io.to(`user:${to}`).emit("call:voicemail", {
      from: socket.userId,
      reason: reason || "unknown"
    });

    log(`call:voicemail from user ${socket.userId} → user ${to}`);
  });

  /* -------------------------------------------------------
     Cleanup on disconnect
  ------------------------------------------------------- */
  socket.on("disconnect", () => {
    log(`Socket disconnected: ${socket.id} (user ${socket.userId || "?"})`);
  });
}



