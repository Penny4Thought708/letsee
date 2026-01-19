export default function registerTyping(io, socket, { isBlocked, isDND }) {
  const toStr = (v) => (v == null ? null : String(v));

  socket.on("typing:start", async ({ from, to }) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);
    if (!sender || !target) return;
    if (await isBlocked(target, sender)) return;
    if (isDND(target)) return;

    io.to(`user:${target}`).emit("typing:start", { from: sender });
  });

  socket.on("typing:stop", async ({ from, to }) => {
    const sender = toStr(from || socket.userId);
    const target = toStr(to);
    if (!sender || !target) return;
    if (await isBlocked(target, sender)) return;
    if (isDND(target)) return;

    io.to(`user:${target}`).emit("typing:stop", { from: sender });
  });
}
