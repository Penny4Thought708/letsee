// project-root/ai/generateGuideAI.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Simple in-memory cache: { [normalizedQuery]: { guide, ts } }
const guideCache = new Map();

// Cache TTL in ms (e.g., 6 hours)
const CACHE_TTL = 6 * 60 * 60 * 1000;

function normalizeQuery(q = "") {
  return q.trim().toLowerCase();
}

function isCacheFresh(entry) {
  if (!entry) return false;
  return Date.now() - entry.ts < CACHE_TTL;
}

function validateGuide(raw, query) {
  const safe = {};

  safe.title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : `DIY Guide: ${query}`;

  safe.difficulty =
    typeof raw.difficulty === "string" && raw.difficulty.trim()
      ? raw.difficulty.trim()
      : "Moderate";

  safe.time =
    typeof raw.time === "string" && raw.time.trim()
      ? raw.time.trim()
      : "2–4 hours";

  safe.tools = Array.isArray(raw.tools)
    ? raw.tools.filter(t => typeof t === "string" && t.trim()).map(t => t.trim())
    : [];

  safe.steps = Array.isArray(raw.steps)
    ? raw.steps.filter(s => typeof s === "string" && s.trim()).map(s => s.trim())
    : [];

  safe.safety = Array.isArray(raw.safety)
    ? raw.safety.filter(s => typeof s === "string" && s.trim()).map(s => s.trim())
    : [];

  // Absolute minimum: at least one step
  if (safe.steps.length === 0) {
    safe.steps.push(`Research basic steps for "${query}" and plan the project before starting.`);
  }

  // Absolute minimum: at least one safety note
  if (safe.safety.length === 0) {
    safe.safety.push("Always follow manufacturer instructions and wear appropriate safety gear.");
  }

  return safe;
}

export async function generateGuideAI(query) {
  const norm = normalizeQuery(query);

  // 1) Cache check
  const cached = guideCache.get(norm);
  if (isCacheFresh(cached)) {
    console.log(`[AI] Cache hit for query: "${norm}"`);
    return cached.guide;
  }

  console.log(`[AI] Cache miss, generating guide for: "${norm}"`);

  const prompt = `
You are a professional DIY home improvement guide generator.

Create a detailed, accurate, step-by-step DIY guide for: "${query}"

Return ONLY valid JSON. No commentary. No markdown. No extra text.

JSON structure:
{
  "title": "string",
  "difficulty": "string",
  "time": "string",
  "tools": ["string", ...],
  "materials": ["string", ...],
  "steps": ["string", ...],
  "safety": ["string", ...]
}
`;

  try {
    const response = await client.responses.create({
      model: "gpt-4o",
      input: prompt,
      response_format: { type: "json_object" }
    });

    // Correct extraction for the new Responses API
    const content = response.output_text;

    let raw;
    try {
      raw = JSON.parse(content);
    } catch (parseErr) {
      console.error("[AI] JSON parse error. Raw content:", content);
      throw new Error("AI returned invalid JSON");
    }

    const guide = validateGuide(raw, query);

    // Save to cache
    guideCache.set(norm, { guide, ts: Date.now() });

    return guide;

  } catch (err) {
    console.error("[AI] generateGuideAI failed:", err);

    // Fallback minimal guide so the app never hard-crashes
    const fallback = validateGuide({}, query);
    return fallback;
  }
}
