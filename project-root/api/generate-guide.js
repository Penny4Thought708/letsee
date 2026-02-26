// project-root/api/generate-generate.js
import fs from "fs";
import path from "path";
import express from "express";
import { generateGuideAI } from "../ai/generateGuideAI.js";

const router = express.Router();

/* ============================================================
   SIMPLE IN-MEMORY RATE LIMIT
   key: ip|query → { count, firstTs }
============================================================ */
const rateBucket = new Map();
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX_REQUESTS = 10;     // per IP+query per window

function rateKey(ip, q) {
  return `${ip}|${q}`;
}

function isRateLimited(ip, q) {
  const key = rateKey(ip, q);
  const now = Date.now();
  const entry = rateBucket.get(key);

  if (!entry) {
    rateBucket.set(key, { count: 1, firstTs: now });
    return false;
  }

  if (now - entry.firstTs > RATE_WINDOW_MS) {
    // reset window
    rateBucket.set(key, { count: 1, firstTs: now });
    return false;
  }

  entry.count += 1;
  if (entry.count > RATE_MAX_REQUESTS) return true;

  return false;
}

/* ============================================================
   ROUTE
============================================================ */
router.get("/", async (req, res, next) => {
  const rawQ = req.query.q;
  const q = rawQ?.trim();

  try {
    if (!q) {
      console.warn("[GUIDE] Missing query");
      return res.status(400).json({ error: "Missing query" });
    }

    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    if (isRateLimited(ip, q.toLowerCase())) {
      console.warn(`[GUIDE] Rate limited: ip=${ip}, q="${q}"`);
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    console.log(`[GUIDE] Request: ip=${ip}, q="${q}"`);

    const slug = slugify(q);

    // Load search index
    const projectsPath = path.join("data", "projects.json");
    let projects = [];

    try {
      if (fs.existsSync(projectsPath)) {
        const raw = fs.readFileSync(projectsPath, "utf8") || "[]";
        projects = JSON.parse(raw);
      }
    } catch (fileErr) {
      console.error("[GUIDE] Failed to read projects.json:", fileErr);
      projects = [];
    }

    // If guide already exists in index → return card + no AI call
    const existing = projects.find(p => p.url === `/guides/${slug}` || p.name?.toLowerCase() === q.toLowerCase());

    if (existing) {
      console.log(`[GUIDE] Existing guide found for "${q}"`);
      return res.json({
        existed: true,
        guide: null,
        card: existing
      });
    }

    // 1) Generate structured guide from AI (with internal caching + validation)
    const ai = await generateGuideAI(q);

    // 2) Build card object (SPA mode)
    const card = {
      name: ai.title,
      category: detectCategory(q),
      url: null,
      desc: ai.steps?.[0] || `A complete step-by-step guide for ${escapeText(q)}.`,
      img: "./img/default-guide.jpg"
    };

    // 3) Save card to search index (best-effort)
    try {
      projects.push(card);
      fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2), "utf8");
      console.log(`[GUIDE] Saved new guide card for "${q}"`);
    } catch (writeErr) {
      console.error("[GUIDE] Failed to write projects.json:", writeErr);
      // Do not fail the request just because of write error
    }

    // 4) Return JSON for inline rendering
    res.json({
      existed: false,
      guide: ai,
      card
    });

  } catch (err) {
    console.error("[GUIDE] GENERATION ERROR:", err);
    // Don’t leak internal error details to client
    res.status(500).json({ error: "Guide generation failed" });
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
