import fs from "fs";
import path from "path";
import express from "express";
import { generateGuideAI } from "../ai/generateGuideAI.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const q = req.query.q?.trim().toLowerCase();
    if (!q) return res.status(400).json({ error: "Missing query" });

    const slug = slugify(q);

    // Load search index
    const projectsPath = path.join("data", "projects.json");
    const projects = JSON.parse(fs.readFileSync(projectsPath, "utf8") || "[]");

    // If guide already exists in index → return card + no AI call
    const existing = projects.find(p => p.url === `/guides/${slug}`);
    if (existing) {
      return res.json({
        existed: true,
        guide: null,
        card: existing
      });
    }

    // 1) Generate structured guide from AI
    const ai = await generateGuideAI(q);

    // 2) Build card object (no HTML file, SPA mode)
    const card = {
      name: ai.title,
      category: detectCategory(q),
      url: null, // IMPORTANT: no navigation
      desc: ai.steps?.[0] || `A complete step-by-step guide for ${escapeText(q)}.`,
      img: "/img/default-guide.jpg"
    };

    // 3) Save card to search index
    projects.push(card);
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2), "utf8");

    // 4) Return JSON for inline rendering
    res.json({
      existed: false,
      guide: ai,
      card
    });

  } catch (err) {
    next(err);
  }
});

/* ============================================================
   HELPERS
============================================================ */
function detectCategory(query) {
  const q = query.toLowerCase();
  if (q.includes("floor")) return "Flooring";
  if (q.includes("paint")) return "Painting";
  if (q.includes("bath")) return "Bathroom";
  if (q.includes("light")) return "Lighting";
  if (q.includes("outdoor")) return "Outdoor";
  return "General";
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, txt =>
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeText(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

export default router;
