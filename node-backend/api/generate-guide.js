import fs from "fs";
import path from "path";
import express from "express";
const router = express.Router();

router.get("/", async (req, res) => {
  const q = req.query.q?.trim().toLowerCase();
  if (!q) return res.status(400).json({ error: "Missing query" });

  const slug = q.replace(/\s+/g, "-");

  const guidePath = path.join("guides", `${slug}.json`);

  // 1. If guide already exists, return it
  if (fs.existsSync(guidePath)) {
    const guide = JSON.parse(fs.readFileSync(guidePath, "utf8"));
    return res.json({ guide, existed: true });
  }

  // 2. Generate guide content (AI or template logic)
  const guide = await generateGuideFromQuery(q);

  // 3. Save guide
  fs.writeFileSync(guidePath, JSON.stringify(guide, null, 2));

  // 4. Add card to search index
  const projectsPath = "data/projects.json";
  const projects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));

  projects.push({
    name: guide.title,
    category: guide.category,
    url: `/guides/${slug}.html`,
    desc: guide.description,
    img: guide.image
  });

  fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));

  res.json({ guide, existed: false });
});

export default router;
