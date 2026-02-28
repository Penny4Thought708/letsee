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
import dotenv from "dotenv";
dotenv.config();

// Redis adapter
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

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
import profileRouter from "./src/routes/profile/index.js";

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

// regex for diy-core.com with/without www
const originPatterns = [/^https:\/\/(www\.)?diy-core\.com$/];

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (originPatterns.some((re) => re.test(origin))) return true;
  console.warn("[CORS] Blocked origin:", origin);
  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

/* -------------------------------------------------------
   SECURITY HEADERS
------------------------------------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

/* -------------------------------------------------------
   RATE LIMITING
------------------------------------------------------- */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, error: "Too many requests" }
});

// ✅ Keep rate limiting on auth only
app.use("/api/auth", authLimiter);

/* -------------------------------------------------------
   CORE MIDDLEWARE
------------------------------------------------------- */
app.set("trust proxy", 1);

app.use(
  morgan(isProd ? "combined" : "dev", {
    skip: (req, res) => isProd && res.statusCode < 400
  })
);

app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

/* -------------------------------------------------------
   SESSION MIDDLEWARE
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
      secure: isProd,        // requires HTTPS in production
      httpOnly: true,
      sameSite: "none",      // needed for cross-site cookies
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
app.use("/api/profile", profileRouter);

/* -------------------------------------------------------
   WEBRTC ICE ROUTE (PUBLIC, NO SESSION REQUIRED)
------------------------------------------------------- */
// ✅ No rate limit, no auth — safe for TURN/STUN discovery
app.use("/api/webrtc", iceRouter);

/* -------------------------------------------------------
   SOCKET.IO SERVER
------------------------------------------------------- */
const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      console.warn("[Socket.IO CORS] Blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 25000
});

/* -------------------------------------------------------
   REDIS ADAPTER
------------------------------------------------------- */
async function setupRedisAdapter() {
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.error("❌ Missing REDIS_URL environment variable");
      return;
    }

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));

    console.log("🔗 Redis adapter connected");
  } catch (err) {
    console.error("❌ Redis adapter failed:", err);
  }
}

setupRedisAdapter();

/* -------------------------------------------------------
   SOCKET AUTH
------------------------------------------------------- */
io.use((socket, next) => {
  const sessionCookie = socket.request.headers.cookie;
  if (!sessionCookie) {
    console.warn("[Socket] Missing session cookie");
    return next(new Error("Unauthorized"));
  }
  next();
});

/* -------------------------------------------------------
   REGISTER SOCKET MODULES
------------------------------------------------------- */
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














