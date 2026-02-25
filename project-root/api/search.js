import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();

router.get("/", (req, res, next) => {
  try {
    const q = req.query.q?.trim().toLowerCase();
    const projectsPath = path.join("data", "projects.json");
    const raw = fs.readFileSync(projectsPath, "utf8") || "[]";
    const projects = JSON.parse(raw);

    if (!q) {
      return res.json(projects);
    }

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

    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

export default router;
