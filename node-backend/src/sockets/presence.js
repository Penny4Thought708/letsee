// src/sockets/presence.js
// Production‑grade presence snapshot + status relay

export default function registerPresence(io, socket, onlineUsers) {
  const log = (msg) => console.log(`[presence] ${msg}`);

  /* -------------------------------------------------------
     Client requests full presence snapshot
  ------------------------------------------------------- */
  socket.on("presence:get", () => {
    try {
      const snapshot = [];

      for (const [userId, entry] of onlineUsers.entries()) {
        snapshot.push({
          contact_id: userId,
          online: true,
          away: entry.away === true
        });
      }

      socket.emit("statusBatch", snapshot);

      log(
        `Sent presence snapshot (${snapshot.length} users) → user ${socket.userId}`
      );
    } catch (err) {
      log(`⚠️ Error generating presence snapshot: ${err.message}`);
    }
  });
}


