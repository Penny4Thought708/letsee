export default function registerVoicemail(io, socket, db) {
  socket.on("voicemail:new", (vm) => {
    io.to(`user:${vm.user_id}`).emit("voicemail:new", vm);
  });
}
