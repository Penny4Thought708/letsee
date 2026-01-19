export default function registerWebRTC(io, socket) {
  socket.on("call:start", ({ to }) => {
    io.to(`user:${to}`).emit("call:start");
  });

  socket.on("call:signal", ({ to, data }) => {
    io.to(`user:${to}`).emit("call:signal", { from: socket.userId, data });
  });

  socket.on("call:end", ({ to }) => {
    io.to(`user:${to}`).emit("call:end", { from: socket.userId });
  });
}
