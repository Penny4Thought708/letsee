// project-root/api/admin.js
import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();

// Absolute path for consistency across backend
const projectsPath = path.join(process.cwd(), "data", "projects.json");

/* ============================================================
   HELPERS
============================================================ */
function slugify(str = "") {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProject(p) {
  const name = (p.name || "").trim();
  const slug = slugify(name);

  return {
    name,
    category: (p.category || "General").trim(),
    desc: (p.desc || "").trim(),
    img: p.img || "/img/default-guide.jpg",
    url: `/guides/${slug}`, // SPA mode still works; frontend can ignore
    slug
  };
}

function isValidProject(p) {
  return (
    typeof p.name === "string" &&
    typeof p.category === "string" &&
    typeof p.desc === "string" &&
    typeof p.img === "string" &&
    typeof p.url === "string" &&
    typeof p.slug === "string"
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

  const newGuide = normalizeProject({
    name,
    category,
    desc,
    img
  });

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
  const filtered = projects.filter(p => p.name?.toLowerCase() !== name);

  if (!saveProjects(filtered)) {
    return res.status(500).json({ error: "Failed to delete guide" });
  }

  res.json({ success: true });
});

export default router;


