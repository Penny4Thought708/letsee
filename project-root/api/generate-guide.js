// project-root/api/generate-guide.js
import fs from "fs";
import path from "path";
import express from "express";
import { generateGuideAI } from "../ai/generateGuideAI.js";
import { generateGuideImageAI } from "../ai/generateGuideImageAI.js";

const router = express.Router();

/* ============================================================
   SIMPLE IN-MEMORY RATE LIMIT
============================================================ */
const rateBucket = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQUESTS = 10;

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
    rateBucket.set(key, { count: 1, firstTs: now });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_MAX_REQUESTS;
}

/* ============================================================
   VALIDATOR
============================================================ */
function isValidProject(p) {
  return (
    typeof p.name === "string" &&
    typeof p.category === "string" &&
    typeof p.desc === "string" &&
    typeof p.img === "string" &&
    typeof p.url === "string"
  );
}

/* ============================================================
   MAIN ROUTE
============================================================ */
router.get("/", async (req, res) => {
  const rawQ = req.query.q;
  const q = rawQ?.trim();

  try {
    if (!q) {
      return res.status(400).json({ error: "Missing query" });
    }

    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    if (isRateLimited(ip, q.toLowerCase())) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const slug = slugify(q);

    const projectsPath = path.join("data", "projects.json");
    let projects = [];

    try {
      if (fs.existsSync(projectsPath)) {
        const raw = fs.readFileSync(projectsPath, "utf8") || "[]";
        projects = JSON.parse(raw);
      }
    } catch {
      projects = [];
    }

    const existing = projects.find(
      p =>
        p.name?.toLowerCase() === q.toLowerCase() ||
        p.url === `/guides/${slug}`
    );

    if (existing) {
      return res.json({
        existed: true,
        guide: null,
        card: existing
      });
    }

    const ai = await generateGuideAI(q);
    const imageUrl = await generateGuideImageAI(q, slug);
    console.log("[AI IMAGE URL]", imageUrl);

    const card = {
      name: ai.title,
      category: detectCategory(q),
      url: "", // ⭐ REQUIRED for validator
      desc: ai.steps?.[0] || `A complete step-by-step guide for ${escapeText(q)}.`,
      img: imageUrl
    };

    if (!isValidProject(card)) {
      console.error("[PROJECT] Invalid project structure:", card);
      return res.status(500).json({ error: "Invalid project structure" });
    }

    try {
      projects.push(card);
      fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2), "utf8");
    } catch (writeErr) {
      console.error("[GUIDE] Failed to write projects.json:", writeErr);
    }

    res.json({
      existed: false,
      guide: ai,
      card
    });

  } catch (err) {
    console.error("[GUIDE] GENERATION ERROR:", err);
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
