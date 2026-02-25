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
      return res.json({ url: `/guides/${slug}.html`, existed: true });
    }

    // Generate guide content
  const ai = await generateGuideAI(q);
const guide = generateGuideHTML(ai);


    // Save guide HTML
    fs.writeFileSync(guidePath, guide, "utf8");

    // Add card to search index
    const projectsPath = path.join("data", "projects.json");
    const projectsRaw = fs.readFileSync(projectsPath, "utf8") || "[]";
    const projects = JSON.parse(projectsRaw);

    projects.push({
      name: toTitleCase(q),
      category: detectCategory(q),
      url: `/guides/${slug}.html`,
      desc: `A complete step-by-step guide for ${escapeText(q)}.`,
      img: "./img/default-guide.jpg"
    });

    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2), "utf8");

    res.json({ url: `/guides/${slug}.html`, existed: false });
  } catch (err) {
    next(err);
  }
});

function generateGuideFromQuery(query) {
  const title = toTitleCase(query);
  const safeTitle = escapeHtml(title);

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${safeTitle}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    <main class="guide-page">
      <header class="guide-hero">
        <h1>${safeTitle}</h1>
        <p class="guide-subtitle">Difficulty: Beginner • Time: 1–3 hours</p>
      </header>

      <section class="guide-section">
        <h2>Tools &amp; Materials</h2>
        <ul class="guide-list">
          <li>Safety gear</li>
          <li>Measuring tools</li>
          <li>Basic DIY tools</li>
        </ul>
      </section>

      <section class="guide-section">
        <h2>Step‑by‑Step Instructions</h2>
        <ol class="guide-steps">
          <li>Prepare your workspace.</li>
          <li>Gather materials.</li>
          <li>Follow installation steps.</li>
          <li>Finish and clean up.</li>
        </ol>
      </section>

      <section class="guide-section">
        <h2>Tips &amp; Safety</h2>
        <p>Always follow manufacturer safety guidelines.</p>
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

// For non-HTML text fields (like desc)
function escapeText(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

export default router;
