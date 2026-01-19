export default function registerPresence(io, socket, onlineUsers) {
  socket.on("presence:get", () => {
    const users = [];

    for (const [userId, entry] of onlineUsers.entries()) {
      users.push({
        contact_id: userId,
        online: true,
        away: entry.away || false
      });
    }

    socket.emit("statusBatch", users);
  });
}
