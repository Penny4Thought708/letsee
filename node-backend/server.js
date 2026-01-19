import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import db from "./src/db.js";
import authMiddleware from "./src/middleware/auth.js";

import authLoginRouter from "./src/routes/auth/login.js";
import authMeRouter from "./src/routes/auth/me.js";
import contactsRouter from "./src/routes/contacts/index.js";
import messagesRouter from "./src/routes/messages/index.js";
import voicemailRouter from "./src/routes/voicemail/index.js";
import callLogsRouter from "./src/routes/callLogs/index.js";
import usersRouter from "./src/routes/users/search.js";

import registerSockets from "./src/sockets/index.js";
import logoutRouter from "./src/routes/auth/logout.js";
app.use("/api/auth", logoutRouter);
import logoutAllRouter from "./src/routes/auth/logoutAll.js";
app.use("/api/auth", logoutAllRouter);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "https://letsee-vv23.onrender.com",
  "https://letsee-backend.onrender.com",
  "https://penny4thought708.github.io"
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.sendStatus(200);
});

app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use("/api/auth", authLoginRouter);
app.use("/api/auth", authMeRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/voicemail", voicemailRouter);
app.use("/api/call-logs", callLogsRouter);
app.use("/api/users", usersRouter);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

registerSockets(io, db);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


