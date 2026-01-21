// src/sockets/webrtc.js

export default function registerWebRTC(io, socket) {
  // ⭐ WebRTC signaling relay
  socket.on("webrtc:signal", (data) => {
    const { to } = data;
    if (!to) return;

    // Relay to all sockets for that user
    io.to(`user:${to}`).emit("webrtc:signal", {
      ...data,
      from: socket.userId
    });

    console.log(
      `[webrtc] Relayed '${data.type}' from user ${socket.userId} → user ${to}`
    );
  });

  // ⭐ Optional: call end shortcut
  socket.on("call:end", ({ to }) => {
    if (!to) return;

    io.to(`user:${to}`).emit("call:end", {
      from: socket.userId
    });

    console.log(
      `[webrtc] call:end from user ${socket.userId} → user ${to}`
    );
  });
}

