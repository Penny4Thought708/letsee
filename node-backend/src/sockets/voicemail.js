// src/sockets/voicemail.js
// Production‑grade voicemail relay

export default function registerVoicemail(io, socket, db) {
  const log = (msg) => console.log(`[voicemail] ${msg}`);

  socket.on("voicemail:new", (vm = {}) => {
    const { user_id } = vm;

    if (!user_id) {
      log(`⚠️ Invalid voicemail:new payload from socket ${socket.id}`);
      return;
    }

    // Relay to all devices for the target user
    io.to(`user:${user_id}`).emit("voicemail:new", vm);

    log(`Delivered voicemail notification → user ${user_id}`);
  });
}

