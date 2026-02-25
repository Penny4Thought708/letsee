import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();

// --- Search Scoring Function ---
function scoreProject(project, q) {
  const query = q.toLowerCase();
  let score = 0;

  if (project.name.toLowerCase().includes(query)) score += 5;
  if (project.category.toLowerCase().includes(query)) score += 3;
  if (project.desc.toLowerCase().includes(query)) score += 1;

  return score;
}

router.get("/", (req, res, next) => {
  try {
    const q = req.query.q?.trim().toLowerCase() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const projectsPath = path.join("data", "projects.json");
    const raw = fs.readFileSync(projectsPath, "utf8") || "[]";
    const projects = JSON.parse(raw);

    // If no query, return paginated full list
    if (!q) {
      const start = (page - 1) * limit;
      const end = start + limit;

      return res.json({
        page,
        limit,
        total: projects.length,
        totalPages: Math.ceil(projects.length / limit),
        results: projects.slice(start, end).map(stripURL)
      });
    }

    // Filter results
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

    // Rank results
    const ranked = filtered
      .map(p => ({ ...p, score: scoreProject(p, q) }))
      .sort((a, b) => b.score - a.score);

    // Pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = ranked.slice(start, end).map(stripURL);

    res.json({
      page,
      limit,
      total: ranked.length,
      totalPages: Math.ceil(ranked.length / limit),
      results: paginated
    });

  } catch (err) {
    next(err);
  }
});

// Remove URL so frontend does not navigate away
function stripURL(project) {
  return {
    ...project,
    url: null
  };
}

export default router;
