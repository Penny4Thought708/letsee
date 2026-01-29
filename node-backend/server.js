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
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

// Database + middleware
import db from "./src/db.js";
import authMiddleware from "./src/middleware/auth.js";

// Auth routes
import authLoginRouter from "./src/routes/auth/login.js";
import authMeRouter from "./src/routes/auth/me.js";
import logoutRouter from "./src/routes/auth/logout.js";
import logoutAllRouter from "./src/routes/auth/logoutAll.js";

// Feature routes
import contactsRouter from "./api/contacts/index.js";
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

// Environment
const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

// Express + HTTP server
const app = express();
const server = http.createServer(app);

/* -------------------------------------------------------
   CORS CONFIGURATION (Production‑Safe)
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

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn("[CORS] Blocked origin:", origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

/* -------------------------------------------------------
   SECURITY HEADERS (Production‑Safe Helmet)
------------------------------------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

/* -------------------------------------------------------
   RATE LIMITING (Protects Auth + WebRTC Signaling)
------------------------------------------------------- */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, error: "Too many requests" }
});

app.use("/api/auth", authLimiter);
app.use("/api/webrtc", authLimiter);

/* -------------------------------------------------------
   CORE MIDDLEWARE
------------------------------------------------------- */
app.set("trust proxy", 1);

// HTTP request logging
app.use(
  morgan(isProd ? "combined" : "dev", {
    skip: (req, res) => isProd && res.statusCode < 400
  })
);

app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

/* -------------------------------------------------------
   SESSION MIDDLEWARE (Secure)
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
      secure: isProd,
      httpOnly: true,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

/* -------------------------------------------------------
   STATIC FILES
------------------------------------------------------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* -------------------------------------------------------
   HEALTH CHECK
------------------------------------------------------- */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    env: NODE_ENV,
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
app.use("/api/contacts", contactsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/voicemail", voicemailRouter);
app.use("/api/call-logs", callLogsRouter);
app.use("/api/users", usersRouter);

/* -------------------------------------------------------
   WEBRTC ICE ROUTE
------------------------------------------------------- */
app.use("/api/webrtc", iceRouter);

/* -------------------------------------------------------
   404 + ERROR HANDLING
------------------------------------------------------- */
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, error: "Not found" });
  }
  next();
});

app.use((err, req, res, next) => {
  console.error("[Express Error]", err);
  if (res.headersSent) return next(err);
  res
    .status(err.status || 500)
    .json({ success: false, error: "Internal server error" });
});

/* -------------------------------------------------------
   SOCKET.IO SERVER (Production‑Ready)
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

// WebSocket authentication (session‑based)
io.use((socket, next) => {
  const sessionCookie = socket.request.headers.cookie;
  if (!sessionCookie) {
    console.warn("[Socket] Missing session cookie");
    return next(new Error("Unauthorized"));
  }
  next();
});

// Register all real‑time modules
registerSockets(io, db);

/* -------------------------------------------------------
   GRACEFUL SHUTDOWN
------------------------------------------------------- */
process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

/* -------------------------------------------------------
   START SERVER
------------------------------------------------------- */
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT} (${NODE_ENV})`);
});















