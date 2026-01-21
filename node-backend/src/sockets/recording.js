// src/sockets/recording.js
// Production‑grade recording indicator relay

export default function registerRecording(io, socket, { isBlocked, isDND }) {
  const toStr = (v) => (v == null ? null : String(v));
  const log = (msg) => console.log(`[recording] ${msg}`);

  /* -------------------------------------------------------
     RECORDING START
  ------------------------------------------------------- */
  socket.on("recording:start", async ({ from, to } = {}) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);

    if (!sender || !target) {
      log(`⚠️ Invalid recording:start payload from socket ${socket.id}`);
      return;
    }

    if (await isBlocked(target, sender)) {
      log(`Blocked recording:start from ${sender} → ${target}`);
      return;
    }

    if (isDND(target)) {
      log(`User ${target} is DND → ignoring recording:start`);
      return;
    }

    io.to(`user:${target}`).emit("recording:start", { from: sender });

    log(`Relayed recording:start from ${sender} → ${target}`);
  });

  /* -------------------------------------------------------
     RECORDING STOP
  ------------------------------------------------------- */
  socket.on("recording:stop", async ({ from, to } = {}) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);

    if (!sender || !target) {
      log(`⚠️ Invalid recording:stop payload from socket ${socket.id}`);
      return;
    }

    if (await isBlocked(target, sender)) {
      log(`Blocked recording:stop from ${sender} → ${target}`);
      return;
    }

    if (isDND(target)) {
      log(`User ${target} is DND → ignoring recording:stop`);
      return;
    }

    io.to(`user:${target}`).emit("recording:stop", { from: sender });

    log(`Relayed recording:stop from ${sender} → ${target}`);
  });
}

