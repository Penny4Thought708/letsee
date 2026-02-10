// src/sockets/messages.js
// Production‑grade messaging + audio + reactions relay

export default function registerMessages(io, socket, db, { isBlocked, isDND }) {
  const toStr = (v) => (v == null ? null : String(v));
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

    io.to(`user:${target}`).emit("message:audio", { from: sender, url });
    io.to(`user:${sender}`).emit("message:audio", { from: sender, url });

    log(`Delivered audio message from ${sender} → ${target}`);
  });

  /* -------------------------------------------------------
     MESSAGE REACTIONS
  ------------------------------------------------------- */
  socket.on("message:reaction", async ({ messageId, emoji }) => {
    const userId = socket.userId;
    if (!messageId || !emoji || !userId) {
      log(`⚠️ Invalid message:reaction payload from socket ${socket.id}`);
      return;
    }

    log(`Reaction received: user ${userId} → msg ${messageId} (${emoji})`);

    try {
      // Check if reaction already exists
      const existing = await db.query(
        `
        SELECT id FROM message_reactions
        WHERE message_id = $1 AND user_id = $2 AND emoji = $3
        `,
        [messageId, userId, emoji]
      );

      let action = "added";

      if (existing.rows.length > 0) {
        // Remove reaction
        await db.query(
          `
          DELETE FROM message_reactions
          WHERE message_id = $1 AND user_id = $2 AND emoji = $3
          `,
          [messageId, userId, emoji]
        );
        action = "removed";
      } else {
        // Add reaction
        await db.query(
          `
          INSERT INTO message_reactions (message_id, user_id, emoji)
          VALUES ($1, $2, $3)
          `,
          [messageId, userId, emoji]
        );
      }

      // Broadcast to all devices of both users
      io.emit("message:reaction:update", {
        messageId,
        emoji,
        action,
        from: userId
      });

      log(`Reaction ${action}: user ${userId} → msg ${messageId} (${emoji})`);

    } catch (err) {
      console.error("[messages] Reaction DB error:", err);
    }
  });
}




