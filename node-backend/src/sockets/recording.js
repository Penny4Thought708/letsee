export default function registerRecording(io, socket, { isBlocked, isDND }) {
  const toStr = (v) => (v == null ? null : String(v));

  socket.on("recording:start", async ({ from, to }) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);
    if (!sender || !target) return;
    if (await isBlocked(target, sender)) return;
    if (isDND(target)) return;

    io.to(`user:${target}`).emit("recording:start", { from: sender });
  });

  socket.on("recording:stop", async ({ from, to }) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);
    if (!sender || !target) return;
    if (await isBlocked(target, sender)) return;
    if (isDND(target)) return;

    io.to(`user:${target}`).emit("recording:stop", { from: sender });
  });
}
