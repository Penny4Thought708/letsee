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
    const guidePath = path.join("public", "guides", `${slug}.html`);

    // If guide already exists, return JSON for frontend rendering
    if (fs.existsSync(guidePath)) {
      const card = buildCardFromExisting(q, slug);
      return res.json({
        existed: true,
        url: `/guides/${slug}.html`,
        card
      });
    }

    // 1) Generate structured guide from AI
    const ai = await generateGuideAI(q);

    // 2) Save HTML version (for SEO + direct linking)
    const html = buildGuideHTML(ai);
    fs.writeFileSync(guidePath, html, "utf8");

    // 3) Build card object for search index + frontend
    const card = {
      name: ai.title,
      category: detectCategory(q),
      url: `/guides/${slug}.html`,
      desc: ai.steps?.[0] || `A complete step-by-step guide for ${escapeText(q)}.`,
      img: "/img/default-guide.jpg"
    };

    // 4) Save card to search index
    const projectsPath = path.join("data", "projects.json");
    const projects = JSON.parse(fs.readFileSync(projectsPath, "utf8") || "[]");
    projects.push(card);
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2), "utf8");

    // 5) Return JSON for frontend to render inside the page
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
   BUILD HTML FILE (SEO + direct link only)
   FRONTEND DOES NOT USE THIS HTML
============================================================ */
function buildGuideHTML(ai) {
  const title = escapeHtml(ai.title);
  const difficulty = escapeHtml(ai.difficulty);
  const time = escapeHtml(ai.time);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="/project_style.css">
  <link href="https://fonts.googleapis.com/css2?family=Oswald&display=swap" rel="stylesheet">
</head>

<body>
  <main class="guide-page">
    <header class="guide-hero">
      <h1>${title}</h1>
      <p class="guide-subtitle">Difficulty: ${difficulty} • Time: ${time}</p>
    </header>

    <section class="guide-section">
      <h2>Tools & Materials</h2>
      <ul class="guide-list">
        ${ai.tools.map(t => `<li>${escapeHtml(t)}</li>`).join("")}
      </ul>
    </section>

    <section class="guide-section">
      <h2>Steps</h2>
      <ol class="guide-steps">
        ${ai.steps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
      </ol>
    </section>

    <section class="guide-section">
      <h2>Safety Notes</h2>
      <ul class="guide-list">
        ${ai.safety.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
      </ul>
    </section>
  </main>
</body>
</html>
`;
}

/* ============================================================
   BUILD CARD FOR EXISTING GUIDE
============================================================ */
function buildCardFromExisting(q, slug) {
  return {
    name: toTitleCase(q),
    category: detectCategory(q),
    url: `/guides/${slug}.html`,
    desc: `A complete step-by-step guide for ${escapeText(q)}.`,
    img: "/img/default-guide.jpg"
  };
}

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

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeText(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

export default router;
