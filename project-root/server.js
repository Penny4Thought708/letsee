import express from "express";
import fs from "fs";
import path from "path";
import generateGuide from "./api/generate-guide.js";
import getGuide from "./api/get-guide.js";
import search from "./api/search.js";
import admin from "./api/admin.js";


const app = express();

// Ensure required directories exist
fs.mkdirSync(path.join("public", "guides"), { recursive: true });
fs.mkdirSync("data", { recursive: true });

// Ensure projects.json exists
const projectsPath = path.join("data", "projects.json");
if (!fs.existsSync(projectsPath)) {
  fs.writeFileSync(projectsPath, "[]", "utf8");
}

app.use(express.json());
app.use(express.static("public"));

app.use("/api/generate-guide", generateGuide);
app.use("/api/guide", getGuide);
app.use("/api/search", search);
app.use("/api/admin", admin);
// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(3000, () => console.log("Server running on port 3000"));

