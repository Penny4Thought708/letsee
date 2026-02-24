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
function generateGuideFromQuery(query) {
  const title = toTitleCase(query);
  const category = detectCategory(query);

  return `
  <main class="guide-page">
    <header class="guide-hero">
      <h1>${title}</h1>
      <p class="guide-subtitle">Difficulty: Beginner • Time: 1–3 hours</p>
    </header>

    <section class="guide-section">
      <h2>Tools & Materials</h2>
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
      <h2>Tips & Safety</h2>
      <p>Always follow manufacturer safety guidelines.</p>
    </section>
  </main>
  `;
}
function detectCategory(query) {
  if (query.includes("floor")) return "Flooring";
  if (query.includes("paint")) return "Painting";
  if (query.includes("bath")) return "Bathroom";
  if (query.includes("light")) return "Lighting";
  if (query.includes("outdoor")) return "Outdoor";
  return "General";
}

export default router;
