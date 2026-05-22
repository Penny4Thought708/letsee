import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

import generateGuide from "./api/generate-guide.js";
import search from "./api/search.js";
import admin from "./api/admin.js";
import assistant from "../node-backend/api/assistant.js";

const app = express();

/* ============================================================
   CORS — REQUIRED FOR GITHUB PAGES → RENDER CONNECTION
============================================================ */
app.use(
  cors({
    origin: "https://penny4thought708.github.io",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  })
);

/* ============================================================
   ENSURE REQUIRED DIRECTORIES EXIST
============================================================ */
const PUBLIC_DIR = path.join(process.cwd(), "public");
const GENERATED_DIR = path.join(process.cwd(), "public", "generated");
const GUIDES_DIR = path.join(PUBLIC_DIR, "guides");
const DATA_DIR = path.join("data");

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(GENERATED_DIR, { recursive: true });   // ⭐ REQUIRED for AI images
fs.mkdirSync(GUIDES_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const projectsPath = path.join(DATA_DIR, "projects.json");
if (!fs.existsSync(projectsPath)) {
  fs.writeFileSync(projectsPath, "[]", "utf8");
}

/* ============================================================
   MIDDLEWARE
============================================================ */
app.use(express.json());

// Serve /public as root
app.use(express.static(PUBLIC_DIR));

// Serve /generated explicitly (AI images)
app.use("/generated", express.static(GENERATED_DIR));

/* ============================================================
   ROUTES
============================================================ */
app.use("/api/generate-guide", generateGuide);
app.use("/api/search", search);
app.use("/api/admin", admin);
app.use("/api/assistant", assistant);

/* ============================================================
   ERROR HANDLER
============================================================ */
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Server error" });
});

/* ============================================================
   START SERVER
============================================================ */
app.listen(3000, () => console.log("Server running on port 3000"));
