// project-root/api/search.js
import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();

/* ============================================================
   SAFE SCORING FUNCTION
============================================================ */
function scoreProject(project, q) {
  const query = q.toLowerCase();
  let score = 0;

  const name = (project.name || "").toLowerCase();
  const category = (project.category || "").toLowerCase();
  const desc = (project.desc || "").toLowerCase();

  if (name.includes(query)) score += 5;
  if (category.includes(query)) score += 3;
  if (desc.includes(query)) score += 1;

  return score;
}

/* ============================================================
   MAIN SEARCH ROUTE
============================================================ */
router.get("/", (req, res, next) => {
  try {
    const q = req.query.q?.trim().toLowerCase() || "";
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);

    const projectsPath = path.join(process.cwd(), "data", "projects.json");

    /* ============================================================
       LOAD PROJECTS SAFELY
    ============================================================ */
    let projects = [];
    try {
      if (fs.existsSync(projectsPath)) {
        const raw = fs.readFileSync(projectsPath, "utf8") || "[]";
        projects = JSON.parse(raw);
      }
    } catch (err) {
      console.error("[SEARCH] Failed to read projects.json:", err);
      projects = [];
    }

    /* ============================================================
       NO QUERY → RETURN PAGINATED FULL LIST
    ============================================================ */
    if (!q) {
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      return res.json({
        page,
        limit,
        total: projects.length,
        totalPages: Math.ceil(projects.length / limit),
        results: projects.slice(startIndex, endIndex).map(stripURL)
      });
    }

    /* ============================================================
       FILTER RESULTS
    ============================================================ */
    const filtered = projects.filter(p => {
      const name = (p.name || "").toLowerCase();
      const desc = (p.desc || "").toLowerCase();
      const category = (p.category || "").toLowerCase();

      return (
        name.includes(q) ||
        desc.includes(q) ||
        category.includes(q)
      );
    });

    /* ============================================================
       RANK RESULTS
    ============================================================ */
    const ranked = filtered
      .map(p => ({ ...p, score: scoreProject(p, q) }))
      .sort((a, b) => b.score - a.score);

    /* ============================================================
       PAGINATION
    ============================================================ */
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginated = ranked.slice(startIndex, endIndex).map(stripURL);

    res.json({
      page,
      limit,
      total: ranked.length,
      totalPages: Math.ceil(ranked.length / limit),
      results: paginated
    });

  } catch (err) {
    console.error("[SEARCH] ERROR:", err);
    next(err);
  }
});

/* ============================================================
   HELPERS
============================================================ */
function stripURL(project) {
  return {
    ...project,
    url: "" // SPA mode: prevent navigation, must be string for validator
  };
}

export default router;

