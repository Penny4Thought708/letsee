// server.js — Production‑Ready Real‑Time Backend


import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import pgSession from "connect-pg-simple";
import path from "path";
import { fileURLToPath } from "url";

// Database + middleware
import db from "./src/db.js";
import authMiddleware from "./src/middleware/auth.js";

// Auth routes
import authLoginRouter from "./src/routes/auth/login.js";
import authMeRouter from "./src/routes/auth/me.js";
import logoutRouter from "./src/routes/auth/logout.js";
import logoutAllRouter from "./src/routes/auth/logoutAll.js";

// Feature routes
import contactsRouter from "./api/contacts/index.js";   // ← UPDATED PATH
import messagesRouter from "./src/routes/messages/index.js";
import voicemailRouter from "./src/routes/voicemail/index.js";
import callLogsRouter from "./src/routes/callLogs/index.js";
import usersRouter from "./src/routes/users/search.js";

// WebRTC ICE route
import iceRouter from "./src/routes/webrtc/ice.js";

// Socket.IO registration
import registerSockets from "./src/sockets/index.js";

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express + HTTP server
const app = express();
const server = http.createServer(app);

/* -------------------------------------------------------
   CORS CONFIGURATION
------------------------------------------------------- */
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

// Preflight handler
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.sendStatus(200);
});

/* -------------------------------------------------------
   CORE MIDDLEWARE
------------------------------------------------------- */
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());

/* -------------------------------------------------------
   SESSION MIDDLEWARE (FIXES req.session undefined)
------------------------------------------------------- */
const PgStore = pgSession(session);

app.use(
  session({
    store: new PgStore({
      pool: db,
      tableName: "session"
    }),
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,       // required on Render
      httpOnly: true,
      sameSite: "none",   // required for cross-origin cookies
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* -------------------------------------------------------
   HEALTH CHECK
------------------------------------------------------- */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/* -------------------------------------------------------
   AUTH ROUTES
------------------------------------------------------- */
app.use("/api/auth", authLoginRouter);
app.use("/api/auth", authMeRouter);
app.use("/api/auth", logoutRouter);
app.use("/api/auth", logoutAllRouter);

/* -------------------------------------------------------
   FEATURE ROUTES
------------------------------------------------------- */
app.use("/api/contacts", contactsRouter);   // ← NOW USING CORRECT ROUTE
app.use("/api/messages", messagesRouter);
app.use("/api/voicemail", voicemailRouter);
app.use("/api/call-logs", callLogsRouter);
app.use("/api/users", usersRouter);

/* -------------------------------------------------------
   WEBRTC ICE ROUTE
------------------------------------------------------- */
app.use("/api/webrtc", iceRouter);

/* -------------------------------------------------------
   SOCKET.IO SERVER
------------------------------------------------------- */
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 25000
});

// Register all real‑time modules
registerSockets(io, db);

/* -------------------------------------------------------
   START SERVER
------------------------------------------------------- */
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});









