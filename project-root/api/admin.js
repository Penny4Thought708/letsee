// project-root/api/admin.js
import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();
const projectsPath = path.join("data", "projects.json");

/* ============================================================
   VALIDATOR
============================================================ */
function isValidProject(p) {
  return (
    typeof p.name === "string" &&
    typeof p.category === "string" &&
    typeof p.desc === "string" &&
    typeof p.img === "string"
  );
}

/* ============================================================
   SAFE FILE READ
============================================================ */
function loadProjects() {
  try {
    if (!fs.existsSync(projectsPath)) return [];
    const raw = fs.readFileSync(projectsPath, "utf8") || "[]";
    return JSON.parse(raw);
  } catch {
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
  } catch {
    return false;
  }
}

/* ============================================================
   GET ALL GUIDES
============================================================ */
router.get("/guides", (req, res) => {
  res.json(loadProjects());
});

/* ============================================================
   CREATE GUIDE
============================================================ */
router.post("/guide", (req, res) => {
  const { name, category, desc, img } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const newGuide = {
    name: name.trim(),
    category: category.trim(),
    url: null,
    desc: desc?.trim() || "",
    img: img || "/img/default-guide.jpg"
  };

  /* ============================================================
     VALIDATE BEFORE SAVING
  ============================================================ */
  if (!isValidProject(newGuide)) {
    console.error("[ADMIN] Invalid project structure:", newGuide);
    return res.status(400).json({ error: "Invalid project structure" });
  }

  const projects = loadProjects();
  projects.push(newGuide);

  if (!saveProjects(projects)) {
    return res.status(500).json({ error: "Failed to save guide" });
  }

  res.json({ success: true, guide: newGuide });
});

/* ============================================================
   DELETE GUIDE
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
