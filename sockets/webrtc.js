// -------------------------------------------------------
// sockets/webrtc.js — FULLY CORRECTED (Two‑Row Logging)
// -------------------------------------------------------
let loadedFrom = "unknown";
try { loadedFrom = import.meta.url; } catch {}

export default function registerWebRTCHandlers(io, socket, helpers) {
  const { isBlocked, isDND, db } = helpers;
  const toStr = (v) => (v == null ? null : String(v));

  // -------------------------------------------------------
  // Active call registry (tracks ongoing calls)
  // -------------------------------------------------------
  const activeCalls = io.activeCalls || new Map();
  io.activeCalls = activeCalls;

  function startCallRecord(callerId, calleeId, audioOnly) {
    const now = Date.now();
    const cid = toStr(callerId);
    const pid = toStr(calleeId);
    if (!cid || !pid) return;

    const info = {
      peerId: pid,
      startedAt: now,
      audioOnly: !!audioOnly,
      initiatorId: cid,
    };

    activeCalls.set(cid, info);
    activeCalls.set(pid, { ...info, peerId: cid });
  }

  function endCallRecord(userId) {
    const uid = toStr(userId);
    if (!uid) return null;

    const entry = activeCalls.get(uid);
    if (!entry) return null;

    const { peerId, startedAt, audioOnly, initiatorId } = entry;
    const duration = Math.max(
      0,
      Math.floor((Date.now() - (startedAt || Date.now())) / 1000)
    );

    activeCalls.delete(uid);
    if (peerId) activeCalls.delete(peerId);

    return { peerId, duration, audioOnly, initiatorId };
  }

  // -------------------------------------------------------
  // Utility: deliver to user
  // -------------------------------------------------------
  function deliverToUser(userId, event, payload) {
    const uid = toStr(userId);
    if (!uid) return;
    io.to(uid).emit(event, payload);
  }

  // -------------------------------------------------------
  // Utility: fetch identity (avatar + name)
  // -------------------------------------------------------
  async function getUserIdentity(userId) {
    const uid = toStr(userId);
    if (!uid) return null;

    try {
      const [rows] = await db.query(
        "SELECT user_id, fullname, avatar FROM users WHERE user_id = ? LIMIT 1",
        [uid]
      );
      if (!rows.length) return null;

      const row = rows[0];
      return {
        user_id: String(row.user_id),
        fullname: row.fullname || null,
        avatar: row.avatar || null,
      };
    } catch (err) {
      console.error("[webrtc] DB identity error:", err);
      return null;
    }
  }

  // -------------------------------------------------------
  // MAIN SIGNALING HANDLER
  // -------------------------------------------------------
  socket.removeAllListeners("webrtc:signal");

  socket.on("webrtc:signal", async (data) => {
    try {
      if (!data || typeof data !== "object") return;

      const { type, to, from, audioOnly } = data;
      const toId = toStr(to);
      const fromId = toStr(from || socket.userId);

      if (!type || !toId || !fromId) return;

      if (await isBlocked(toId, fromId)) return;

      // ---------------------------------------------------
      // OFFER: busy / DND / start call
      // ---------------------------------------------------
      if (type === "offer") {
        if (activeCalls.has(toId)) {
          deliverToUser(fromId, "webrtc:signal", {
            type: "busy",
            from: toId,
            to: fromId,
            reason: "callee-busy",
          });
          return;
        }

        if (isDND(toId)) {
          deliverToUser(fromId, "call:voicemail", {
            to: toId,
            reason: "callee-dnd",
          });
          return;
        }

        startCallRecord(fromId, toId, audioOnly);
      }

      // ---------------------------------------------------
      // OFFER / ANSWER: relay with identity
      // ---------------------------------------------------
      if (type === "offer" || type === "answer") {
        const fromUser = await getUserIdentity(fromId);

        deliverToUser(toId, "webrtc:signal", {
          ...data,
          fromUser,
        });

        return;
      }

      // ---------------------------------------------------
      // ICE relay
      // ---------------------------------------------------
      if (type === "ice") {
        if (!data.candidate) return;

        deliverToUser(toId, "webrtc:signal", {
          type: "ice",
          from: fromId,
          to: toId,
          candidate: data.candidate,
        });

        return;
      }

      // ---------------------------------------------------
      // END: authoritative call logging (TWO ROWS)
      // ---------------------------------------------------
      if (type === "end") {
        const record = endCallRecord(fromId);

        if (record) {
          const { peerId, duration, audioOnly: wasAudioOnly, initiatorId } = record;

          const callerId = initiatorId;
          const receiverId = peerId;
          const callType = wasAudioOnly ? "voice" : "video";

          const reason = (data.reason || "hangup").toLowerCase();

          let status;
          if (["missed", "timeout", "no-answer"].includes(reason)) {
            status = "missed";
          } else if (["rejected", "declined", "busy", "callee-busy"].includes(reason)) {
            status = "rejected";
          } else {
            status = "ended";
          }

          // ---------------------------------------------------
          // INSERT TWO ROWS (caller + receiver)
          // ---------------------------------------------------
          try {
            // Caller perspective
            const [callerRow] = await db.query(
              `INSERT INTO call_logs 
               (caller_id, receiver_id, call_type, direction, status, duration, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, NOW())`,
              [
                callerId,
                receiverId,
                callType,
                "outgoing",
                status,
                duration,
              ]
            );

            // Receiver perspective
            const [receiverRow] = await db.query(
              `INSERT INTO call_logs 
               (caller_id, receiver_id, call_type, direction, status, duration, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, NOW())`,
              [
                callerId,
                receiverId,
                callType,
                "incoming",
                status,
                duration,
              ]
            );

            // ---------------------------------------------------
            // Emit real‑time updates to both users
            // ---------------------------------------------------
            const enrichedCaller = {
              id: callerRow.insertId,
              caller_id: callerId,
              receiver_id: receiverId,
              call_type: callType,
              direction: "outgoing",
              status,
              duration,
              timestamp: new Date().toISOString(),
            };

            const enrichedReceiver = {
              id: receiverRow.insertId,
              caller_id: callerId,
              receiver_id: receiverId,
              call_type: callType,
              direction: "incoming",
              status,
              duration,
              timestamp: new Date().toISOString(),
            };

            deliverToUser(callerId, "call:log:add", enrichedCaller);
            deliverToUser(receiverId, "call:log:add", enrichedReceiver);

          } catch (err) {
            console.error("[webrtc] Call log error:", err);
          }
        }

        deliverToUser(toId, "webrtc:signal", {
          type: "end",
          from: fromId,
          to: toId,
          reason: data.reason || "hangup",
        });

        return;
      }
    } catch (err) {
      console.error("[webrtc] Error handling webrtc:signal:", err, "data:", data);
    }
  });

  // -------------------------------------------------------
  // Cleanup on disconnect
  // -------------------------------------------------------
  socket.on("disconnect", () => {
    const uid = toStr(socket.userId);
    if (!uid) return;

    const record = endCallRecord(uid);
    if (record) {
      console.log(
        `[webrtc] User disconnected during call: userId=${uid}, peerId=${record.peerId}, duration=${record.duration}s`
      );
    }
  });
}



