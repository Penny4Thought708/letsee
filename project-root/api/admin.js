import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();
const projectsPath = path.join("data", "projects.json");

// GET all guides
router.get("/guides", (req, res) => {
  const projects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));
  res.json(projects);
});

// CREATE guide
router.post("/guide", (req, res) => {
  const { name, category, url, desc, img } = req.body;
  const projects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));

  projects.push({ name, category, url, desc, img });
  fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));

  res.json({ success: true });
});

// DELETE guide
router.delete("/guide/:slug", (req, res) => {
  const slug = req.params.slug;
  const projects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));

  const filtered = projects.filter(p => !p.url.includes(slug));
  fs.writeFileSync(projectsPath, JSON.stringify(filtered, null, 2));

  res.json({ success: true });
});

export default router;
