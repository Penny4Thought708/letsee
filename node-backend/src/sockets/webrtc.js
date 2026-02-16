// node-backend/src/sockets/webrtc.js
// -------------------------------------------------------
// Premium, production‑grade WebRTC signaling relay
// With call state, timeout, decline → voicemail, missed → voicemail
// -------------------------------------------------------

export const activeCalls = new Map();
// key: userId
// value: { callerId, receiverId, status: "ringing" | "active" | "ended", timeout? }

export default function registerWebRTC(io, socket, helpers = {}) {
  const { isBlocked, isDND, getSocketsForUser, getUserName } = helpers;

  const log = (...args) => console.log("[webrtc]", ...args);

  /* -------------------------------------------------------
     Core WebRTC Signaling Relay
  ------------------------------------------------------- */
  socket.on("webrtc:signal", async (data = {}) => {
    const { type, to } = data;

    if (!type) return log(`⚠️ Missing type from ${socket.userId}`);
    if (!to) return log(`⚠️ Missing 'to' for signal '${type}'`);

    if (String(to) === String(socket.userId)) {
      return log(`⚠️ Ignored self-signal '${type}'`);
    }

    const callerId = socket.userId;
    const receiverId = to;

    /* ---------------------------------------------------
       OFFER → Start ringing + timeout (only if no active call)
       Renegotiation offers keep existing call state
    --------------------------------------------------- */
    if (type === "offer") {
      const existing =
        activeCalls.get(callerId) || activeCalls.get(receiverId);

      // If there's already an ACTIVE call between these two,
      // this is a renegotiation offer. Do NOT reset call state.
      if (existing && existing.status === "active") {
        log(
          `🔁 Renegotiation offer: ${callerId} ↔ ${receiverId} (keep active state)`
        );
        // Just fall through to relay below.
      } else {
        // Fresh call: clear any stale state first
        activeCalls.delete(callerId);
        activeCalls.delete(receiverId);

        const timeout = setTimeout(() => {
          const call = activeCalls.get(callerId);

          // If call no longer exists, ignore
          if (!call) return;

          // If timeout reference was cleared when call became active, ignore
          if (!call.timeout) {
            log(
              `⏳ Timeout ignored — timeout cleared for ${call.callerId} ↔ ${call.receiverId}`
            );
            return;
          }

          // Only fire timeout if still ringing
          if (call.status !== "ringing") {
            log(
              `⏳ Timeout ignored — call no longer ringing (${call.status}) ${call.callerId} ↔ ${call.receiverId}`
            );
            return;
          }

          log(`⏳ Call timeout: ${callerId} → ${receiverId}`);

          io.to(`user:${callerId}`).emit("call:timeout", {
            from: receiverId,
          });
          io.to(`user:${callerId}`).emit("call:voicemail", {
            from: receiverId,
            reason: "timeout",
          });

          activeCalls.delete(callerId);
          activeCalls.delete(receiverId);
        }, 25000);

        const callState = {
          callerId,
          receiverId,
          status: "ringing",
          timeout,
        };

        activeCalls.set(callerId, callState);
        activeCalls.set(receiverId, callState);

        log(
          `📞 Stored call state: ${callerId} → ${receiverId} (ringing)`
        );

        // 🔔 Notify callee of inbound call (UI-level event)
        io.to(`user:${receiverId}`).emit("call:start", {
          from: callerId,
          type:
            data.offer?.sdp && data.offer.sdp.includes("m=video")
              ? "video"
              : "voice",
        });
      }
    }

    /* ---------------------------------------------------
       ANSWER → Mark active + broadcast call:accept
    --------------------------------------------------- */
    if (type === "answer") {
      const call = activeCalls.get(socket.userId);
      if (call) {
        if (call.timeout) {
          clearTimeout(call.timeout);
          call.timeout = null; // ⭐ ensure timeout callback knows it's invalid
        }

        call.status = "active";
        activeCalls.set(call.callerId, call);
        activeCalls.set(call.receiverId, call);

        log(
          `✅ Call active (via answer) ${call.callerId} ↔ ${call.receiverId}`
        );

        const otherId =
          socket.userId === call.callerId ? call.receiverId : call.callerId;

        const targets = getSocketsForUser?.(otherId) || [];
        for (const sid of targets) {
          io.to(sid).emit("call:accept", { from: socket.userId });
        }
      }
    }

    /* ---------------------------------------------------
       END → Clear state + notify other side
    --------------------------------------------------- */
    if (type === "end") {
      const call =
        activeCalls.get(callerId) || activeCalls.get(receiverId);

      if (call?.timeout) {
        clearTimeout(call.timeout);
        call.timeout = null;
      }

      if (call) {
        const { callerId: cId, receiverId: rId } = call;
        const otherId = socket.userId === cId ? rId : cId;

        // Notify the other side that the call ended
        if (otherId) {
          io.to(`user:${otherId}`).emit("call:end", {
            from: socket.userId,
            reason: data.reason || "hangup",
          });
        }

        activeCalls.delete(cId);
        activeCalls.delete(rId);
      }

      log(`📞 webrtc:signal 'end' from ${callerId} → ${receiverId}`);
    }

    /* ---------------------------------------------------
       Block / DND checks
    --------------------------------------------------- */
    if (isBlocked && (await isBlocked(to, socket.userId))) {
      log(`🚫 Blocked: ${socket.userId} → ${to}`);
      return;
    }

    if (isDND && isDND(to)) {
      log(`🔕 DND: user ${to}`);

      io.to(`user:${socket.userId}`).emit("call:dnd", { from: to });
      io.to(`user:${socket.userId}`).emit("call:voicemail", {
        from: to,
        reason: "dnd",
      });

      return;
    }

    /* ---------------------------------------------------
       Relay WebRTC signal to all devices of target user
    --------------------------------------------------- */
    const targets = getSocketsForUser?.(to) || [];
    if (targets.length === 0) {
      log(`⚠️ No sockets for user ${to}`);
      return;
    }

    for (const sid of targets) {
      io.to(sid).emit("webrtc:signal", {
        ...data,
        from: socket.userId,
      });
    }

    log(
      `📡 Relayed '${type}' from ${socket.userId} → ${to} (${targets.length} devices)`
    );
  });

  /* -------------------------------------------------------
     Explicit Call Accept (frontend)
  ------------------------------------------------------- */
  socket.on("call:accept", ({ to } = {}) => {
    if (!to) return log(`⚠️ call:accept missing 'to'`);

    const accepterId = socket.userId;
    const otherId = to;

    const call =
      activeCalls.get(accepterId) || activeCalls.get(otherId);

    if (!call) {
      return log(`❌ call:accept with no active ringing call`);
    }

    if (call.timeout) {
      clearTimeout(call.timeout);
      call.timeout = null;
    }

    call.status = "active";
    activeCalls.set(call.callerId, call);
    activeCalls.set(call.receiverId, call);

    log(
      `✅ Call active (via call:accept) ${call.callerId} ↔ ${call.receiverId}`
    );

    const targets = getSocketsForUser?.(otherId) || [];
    for (const sid of targets) {
      io.to(sid).emit("call:accept", { from: accepterId });
    }
  });

  /* -------------------------------------------------------
     Decline → Voicemail
  ------------------------------------------------------- */
  socket.on("call:decline", ({ to } = {}) => {
    if (!to) return;

    const declinerId = socket.userId;
    const otherId = to;

    const call =
      activeCalls.get(declinerId) || activeCalls.get(otherId);

    if (!call) {
      return log(`❌ call:decline with no active call`);
    }

    // If call is already active, ignore decline
    if (call.status === "active") {
      log(
        `⚠️ Ignored call:decline for active call ${call.callerId} ↔ ${call.receiverId}`
      );
      return;
    }

    if (call.timeout) {
      clearTimeout(call.timeout);
      call.timeout = null;
    }

    log(`❌ Call declined: ${declinerId} → ${otherId}`);

    const notifyId =
      declinerId === call.callerId ? call.receiverId : call.callerId;

    io.to(`user:${notifyId}`).emit("call:declined", {
      from: declinerId,
    });
    io.to(`user:${notifyId}`).emit("call:voicemail", {
      from: declinerId,
      reason: "declined",
    });

    activeCalls.delete(call.callerId);
    activeCalls.delete(call.receiverId);
  });

  /* -------------------------------------------------------
     Missed Call → Voicemail
  ------------------------------------------------------- */
  socket.on("disconnect", () => {
    log(`Socket disconnected: ${socket.id} (user ${socket.userId})`);

    const userId = socket.userId;
    if (!userId) return;

    for (const [key, call] of activeCalls.entries()) {
      if (call.callerId === userId || call.receiverId === userId) {
        const { callerId, receiverId, status, timeout } = call;

        if (timeout) clearTimeout(timeout);

        // Only treat as missed if it was still ringing
        if (receiverId === userId && status === "ringing") {
          log(`📵 Missed call: ${callerId} → ${receiverId}`);

          io.to(`user:${callerId}`).emit("call:missed", {
            from: receiverId,
          });
          io.to(`user:${callerId}`).emit("call:voicemail", {
            from: receiverId,
            reason: "missed",
          });
        }

        activeCalls.delete(callerId);
        activeCalls.delete(receiverId);
      }
    }
  });
}









