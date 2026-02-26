import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

import generateGuide from "./api/generate-guide.js";

import search from "./api/search.js";
import admin from "./api/admin.js";

// REMOVE upload import if the file does not exist
// import upload from "./api/upload.js";

const app = express();

/* ============================================================
   CORS — REQUIRED FOR GITHUB PAGES → RENDER CONNECTION
============================================================ */
app.use(
  cors({
    origin: "https://penny4thought708.github.io", // your frontend
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  })
);

/* ============================================================
   DIRECTORY SAFETY
============================================================ */
fs.mkdirSync(path.join("public", "guides"), { recursive: true });
fs.mkdirSync("data", { recursive: true });
fs.mkdirSync(path.join("public", "generated"), { recursive: true }); // ⭐ ADD THIS


const projectsPath = path.join("data", "projects.json");
if (!fs.existsSync(projectsPath)) {
  fs.writeFileSync(projectsPath, "[]", "utf8");
}

/* ============================================================
   MIDDLEWARE
============================================================ */
app.use(express.json());
app.use(express.static("public"));

/* ============================================================
   ROUTES
============================================================ */
app.use("/api/generate-guide", generateGuide);

app.use("/api/search", search);
app.use("/api/admin", admin);
app.use("/generated", express.static("public/generated"));

// REMOVE upload route if file does not exist
// app.use("/api/upload", upload);

/* ============================================================
   ERROR HANDLER
============================================================ */
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Server error" });
});

/* ============================================================
   START SERVER
============================================================ */
app.listen(3000, () => console.log("Server running on port 3000"));

