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

    // If guide already exists, return it
    if (fs.existsSync(guidePath)) {
      return res.json({
        url: `/guides/${slug}.html`,
        existed: true
      });
    }

    // 1) Get structured guide from AI
    const ai = await generateGuideAI(q);
    // ai is expected to have: title, difficulty, time, tools[], steps[], safety[]

    // 2) Turn AI output into full HTML page
    const guide = generateGuideHTML(ai);

    // 3) Save guide HTML
    fs.writeFileSync(guidePath, guide, "utf8");

    // 4) Add card to search index
    const projectsPath = path.join("data", "projects.json");
    const projectsRaw = fs.readFileSync(projectsPath, "utf8") || "[]";
    const projects = JSON.parse(projectsRaw);

    const card = {
      name: ai.title || toTitleCase(q),
      category: detectCategory(q),
      url: `/guides/${slug}.html`,
      desc: ai.steps?.[0] || `A complete step-by-step guide for ${escapeText(q)}.`,
      img: "/img/default-guide.jpg"
    };

    projects.push(card);
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2), "utf8");

    // 5) Return URL + card for immediate frontend display
    res.json({
      url: `/guides/${slug}.html`,
      existed: false,
      card
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Build full HTML page from AI output
 */
function generateGuideHTML(ai) {
  const title = escapeHtml(ai.title || "DIY Guide");
  const difficulty = escapeHtml(ai.difficulty || "Unknown");
  const time = escapeHtml(ai.time || "Varies");

  const tools = Array.isArray(ai.tools) ? ai.tools : [];
  const steps = Array.isArray(ai.steps) ? ai.steps : [];
  const safety = Array.isArray(ai.safety) ? ai.safety : [];

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    <main class="guide-page">
      <header class="guide-hero">
        <h1>${title}</h1>
        <p class="guide-subtitle">
          Difficulty: ${difficulty} • Time: ${time}
        </p>
      </header>

      <section class="guide-section">
        <h2>Tools &amp; Materials</h2>
        <ul class="guide-list">
          ${tools.map(t => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>
      </section>

      <section class="guide-section">
        <h2>Step‑by‑Step Instructions</h2>
        <ol class="guide-steps">
          ${steps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
        </ol>
      </section>

      <section class="guide-section">
        <h2>Safety Notes</h2>
        <ul class="guide-list">
          ${safety.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
      </section>
    </main>
  </body>
  </html>
  `;
}

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
