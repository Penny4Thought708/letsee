// src/sockets/messages.js
// Production‑grade messaging + audio messaging relay

export default function registerMessages(io, socket, db, { isBlocked, isDND }) {
  const toStr = (v) => (v == null ? null : String(v));

  /* -------------------------------------------------------
     Logging Helper
  ------------------------------------------------------- */
  const log = (msg) => console.log(`[messages] ${msg}`);

  /* -------------------------------------------------------
     TEXT MESSAGE
  ------------------------------------------------------- */
  socket.on("message:new", async (msg = {}) => {
    const toId = toStr(msg.receiver_id || msg.to);
    const fromId = toStr(msg.sender_id || msg.from || socket.userId);

    if (!toId || !fromId) {
      log(`⚠️ Invalid message:new payload from socket ${socket.id}`);
      return;
    }

    if (await isBlocked(toId, fromId)) {
      log(`Blocked: user ${fromId} → user ${toId}`);
      return;
    }

    // Relay to both sender and receiver (multi‑device safe)
    io.to(`user:${toId}`).emit("message:new", msg);
    io.to(`user:${fromId}`).emit("message:new", msg);

    log(`Delivered text message from ${fromId} → ${toId}`);
  });

  /* -------------------------------------------------------
     AUDIO MESSAGE
  ------------------------------------------------------- */
  socket.on("message:audio", async ({ from, to, url } = {}) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);

    if (!sender || !target || !url) {
      log(`⚠️ Invalid message:audio payload from socket ${socket.id}`);
      return;
    }

    if (await isBlocked(target, sender)) {
      log(`Blocked audio: user ${sender} → user ${target}`);
      return;
    }

    /* ---------------------------------------------------
       DND → Convert audio message into voicemail
    --------------------------------------------------- */
    if (isDND(target)) {
      log(`User ${target} is DND → storing voicemail from ${sender}`);

      await db.query(
        "INSERT INTO voicemails (user_id, from_id, audio_url) VALUES ($1, $2, $3)",
        [target, sender, url]
      );

      io.to(`user:${target}`).emit("voicemail:new", {
        from_id: sender,
        audio_url: url,
        timestamp: new Date().toISOString(),
        listened: 0
      });

      return;
    }

    /* ---------------------------------------------------
       Normal audio message delivery
    --------------------------------------------------- */
    io.to(`user:${target}`).emit("message:audio", {
      from: sender,
      url
    });

    io.to(`user:${sender}`).emit("message:audio", {
      from: sender,
      url
    });

    log(`Delivered audio message from ${sender} → ${target}`);
  });
}


