// src/sockets/typing.js
// Production‑grade typing indicator relay

export default function registerTyping(io, socket, { isBlocked, isDND }) {
  const toStr = (v) => (v == null ? null : String(v));
  const log = (msg) => console.log(`[typing] ${msg}`);

  /* -------------------------------------------------------
     TYPING START
  ------------------------------------------------------- */
  socket.on("typing:start", async ({ from, to } = {}) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);

    if (!sender || !target) {
      log(`⚠️ Invalid typing:start payload from socket ${socket.id}`);
      return;
    }

    if (await isBlocked(target, sender)) {
      log(`Blocked typing:start from ${sender} → ${target}`);
      return;
    }

    if (isDND(target)) {
      log(`User ${target} is DND → ignoring typing:start`);
      return;
    }

    io.to(`user:${target}`).emit("typing:start", { from: sender });

    log(`Relayed typing:start from ${sender} → ${target}`);
  });

  /* -------------------------------------------------------
     TYPING STOP
  ------------------------------------------------------- */
  socket.on("typing:stop", async ({ from, to } = {}) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);

    if (!sender || !target) {
      log(`⚠️ Invalid typing:stop payload from socket ${socket.id}`);
      return;
    }

    if (await isBlocked(target, sender)) {
      log(`Blocked typing:stop from ${sender} → ${target}`);
      return;
    }

    if (isDND(target)) {
      log(`User ${target} is DND → ignoring typing:stop`);
      return;
    }

    io.to(`user:${target}`).emit("typing:stop", { from: sender });

    log(`Relayed typing:stop from ${sender} → ${target}`);
  });
}


