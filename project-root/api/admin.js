// project-root/api/admin.js
import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();
const projectsPath = path.join("data", "projects.json");

/* ============================================================
   SAFE FILE READ
============================================================ */
function loadProjects() {
  try {
    if (!fs.existsSync(projectsPath)) return [];
    const raw = fs.readFileSync(projectsPath, "utf8") || "[]";
    return JSON.parse(raw);
  } catch (err) {
    console.error("[ADMIN] Failed to read projects.json:", err);
    return [];
  }
}

/* ============================================================
   SAFE FILE WRITE
============================================================ */
function saveProjects(projects) {
  try {
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[ADMIN] Failed to write projects.json:", err);
    return false;
  }
}

/* ============================================================
   GET ALL GUIDES
============================================================ */
router.get("/guides", (req, res) => {
  const projects = loadProjects();
  res.json(projects);
});

/* ============================================================
   CREATE GUIDE (SPA MODE — NO URL)
============================================================ */
router.post("/guide", (req, res) => {
  const { name, category, desc, img } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const projects = loadProjects();

  const newGuide = {
    name: name.trim(),
    category: category.trim(),
    url: null, // SPA mode
    desc: desc?.trim() || "",
    img: img || "/img/default-guide.jpg"
  };

  projects.push(newGuide);

  if (!saveProjects(projects)) {
    return res.status(500).json({ error: "Failed to save guide" });
  }

  res.json({ success: true, guide: newGuide });
});

/* ============================================================
   DELETE GUIDE (SPA MODE — DELETE BY NAME)
============================================================ */
router.delete("/guide/:name", (req, res) => {
  const name = req.params.name?.trim().toLowerCase();
  if (!name) {
    return res.status(400).json({ error: "Missing guide name" });
  }

  const projects = loadProjects();
  const filtered = projects.filter(p => p.name.toLowerCase() !== name);

  if (!saveProjects(filtered)) {
    return res.status(500).json({ error: "Failed to delete guide" });
  }

  res.json({ success: true });
});

export default router;
