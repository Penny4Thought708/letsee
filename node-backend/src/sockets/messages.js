export default function registerMessages(io, socket, db, { isBlocked, isDND }) {
  const toStr = (v) => (v == null ? null : String(v));

  socket.on("message:new", async (msg) => {
    const toId = toStr(msg.receiver_id || msg.to);
    const fromId = toStr(msg.sender_id || msg.from || socket.userId);
    if (!toId || !fromId) return;
    if (await isBlocked(toId, fromId)) return;

    io.to(`user:${toId}`).emit("message:new", msg);
    io.to(`user:${fromId}`).emit("message:new", msg);
  });

  socket.on("message:audio", async ({ from, to, url }) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);
    if (!sender || !target) return;
    if (await isBlocked(target, sender)) return;

    if (isDND(target)) {
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
  });
}
