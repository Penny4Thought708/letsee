import fs from "fs";
import path from "path";
import express from "express";
const router = express.Router();

router.get("/", async (req, res) => {
  const q = req.query.q?.trim().toLowerCase();
  if (!q) return res.status(400).json({ error: "Missing query" });

  const slug = q.replace(/\s+/g, "-");
  const guidePath = path.join("public/guides", `${slug}.html`);

  // If guide already exists, return it
  if (fs.existsSync(guidePath)) {
    return res.json({ url: `/guides/${slug}.html`, existed: true });
  }

  // Generate guide content
  const guide = generateGuideFromQuery(q);

  // Save guide HTML
  fs.writeFileSync(guidePath, guide);

  // Add card to search index
  const projectsPath = "data/projects.json";
  const projects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));

  projects.push({
    name: toTitleCase(q),
    category: detectCategory(q),
    url: `/guides/${slug}.html`,
    desc: `A complete step-by-step guide for ${q}.`,
    img: "/img/default-guide.jpg"
  });

  fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));

  res.json({ url: `/guides/${slug}.html`, existed: false });
});

export default router;
