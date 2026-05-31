// project-root/ai/generateGuideAI.js
/**
 * Production-ready helper to generate DIY guides via the OpenAI Responses API.
 *
 * Key fixes:
 * - Uses json_schema structured output to force required fields and min steps
 * - Sends role-based input (system + user)
 * - Low temperature, higher token budget
 * - Debug logging of raw response for troubleshooting
 */

import { openai } from "./openaiClient.js";

/** Cache and configuration */
const guideCache = new Map();
const CACHE_TTL = Number(process.env.GUIDE_CACHE_TTL_MS) || 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = Number(process.env.GUIDE_CACHE_MAX) || 500;
const DEFAULT_MODEL = process.env.GUIDE_MODEL || "gpt-4o";
const REQUEST_TIMEOUT_MS = Number(process.env.GUIDE_REQUEST_TIMEOUT_MS) || 20_000;
const MAX_RETRIES = Number(process.env.GUIDE_MAX_RETRIES) || 2;
const MAX_OUTPUT_TOKENS = Number(process.env.GUIDE_MAX_OUTPUT_TOKENS) || 1200;
const TEMPERATURE = Number(process.env.GUIDE_TEMPERATURE) || 0.2;

/** Helpers */
function normalizeQuery(q = "") {
  return q.trim().toLowerCase();
}
function isCacheFresh(entry) {
  if (!entry) return false;
  return Date.now() - entry.ts < CACHE_TTL;
}
function pruneCacheIfNeeded() {
  if (guideCache.size <= CACHE_MAX_ENTRIES) return;
  const entries = Array.from(guideCache.entries());
  entries.sort((a, b) => a[1].ts - b[1].ts);
  const toRemove = entries.slice(0, entries.length - CACHE_MAX_ENTRIES);
  for (const [k] of toRemove) guideCache.delete(k);
}

function validateGuide(raw = {}, query = "") {
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
    ? raw.tools.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim())
    : [];

  safe.materials = Array.isArray(raw.materials)
    ? raw.materials.filter((m) => typeof m === "string" && m.trim()).map((m) => m.trim())
    : [];

  safe.steps = Array.isArray(raw.steps)
    ? raw.steps.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim())
    : [];

  safe.safety = Array.isArray(raw.safety)
    ? raw.safety.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim())
    : [];

  if (safe.steps.length === 0) {
    safe.steps.push(`Research basic steps for "${query}" and plan the project before starting.`);
  }

  if (safe.safety.length === 0) {
    safe.safety.push("Always follow manufacturer instructions and wear appropriate safety gear.");
  }

  if (safe.materials.length === 0) {
    safe.materials.push("Materials will vary depending on the project; confirm quantities before starting.");
  }

  return safe;
}

/**
 * Defensive extractor for Responses API output.
 * Handles json_schema structured output, parsed json content, and text fallbacks.
 */
function extractJsonTextFromResponse(response) {
  if (!response || !Array.isArray(response.output)) return null;

  // 1) Look for structured json_schema output (SDK may put it in content items)
  for (const out of response.output) {
    if (Array.isArray(out.content)) {
      for (const c of out.content) {
        // SDK may return parsed JSON under c.json or c.value for structured outputs
        if (c?.type === "json_schema" && c?.json) {
          return typeof c.json === "string" ? c.json : JSON.stringify(c.json);
        }
        if (c?.type === "json" && c?.json) {
          return typeof c.json === "string" ? c.json : JSON.stringify(c.json);
        }
        if (c?.type === "application/json" && c?.json) {
          return typeof c.json === "string" ? c.json : JSON.stringify(c.json);
        }
        // Some SDKs include a 'value' or 'parsed' field
        if (c?.parsed) {
          return typeof c.parsed === "string" ? c.parsed : JSON.stringify(c.parsed);
        }
        if (c?.value && typeof c.value === "object") {
          return JSON.stringify(c.value);
        }
      }
    }
  }

  // 2) Fallback: find text content that looks like JSON
  for (const out of response.output) {
    if (Array.isArray(out.content)) {
      for (const c of out.content) {
        if ((c?.type === "output_text" || c?.type === "text") && (c.text || c.content)) {
          const txt = c.text ?? c.content;
          if (typeof txt === "string" && txt.trim().startsWith("{")) return txt;
        }
      }
    }
    if (typeof out.text === "string" && out.text.trim().startsWith("{")) {
      return out.text;
    }
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main function
 */
export async function generateGuideAI(query, opts = {}) {
  const logger = opts.logger ?? console;
  if (!query || typeof query !== "string") {
    throw new TypeError("generateGuideAI: query must be a non-empty string");
  }

  const norm = normalizeQuery(query);

  // Cache lookup
  const cached = guideCache.get(norm);
  if (isCacheFresh(cached)) {
    logger.debug?.(`[AI] Cache hit for query: "${norm}"`);
    return cached.guide;
  }

  logger.info?.(`[AI] Cache miss, generating guide for: "${norm}"`);

  // Prompt with a short example to reduce malformed output
  const userPrompt = `
Create a detailed, accurate, step-by-step DIY guide for: "${query}"

Return ONLY valid JSON that matches the schema provided in the response_format.
Do not include any commentary, markdown, or extra text.

Example of expected JSON (short):
{
  "title": "How to paint a small bathroom",
  "difficulty": "Easy",
  "time": "3 hours",
  "tools": ["Paint roller", "Brush", "Drop cloth"],
  "materials": ["Interior paint 1 gallon", "Painter's tape"],
  "steps": [
    "Prepare the room: remove fixtures, cover floors with drop cloths.",
    "Clean and sand surfaces to be painted.",
    "Apply primer to patched areas and let dry.",
    "Cut in edges with a brush, then roll paint on walls in sections.",
    "Apply a second coat if needed and remove tape while paint is tacky.",
    "Clean up brushes and ventilate the room."
  ],
  "safety": ["Wear gloves and eye protection", "Ensure good ventilation"]
}
`;

  // Build request payload using role-based input and json_schema structured output
  const payload = {
    model: DEFAULT_MODEL,
    input: [
      { role: "system", content: [{ type: "input_text", text: "You are a professional DIY home improvement guide generator." }] },
      { role: "user", content: [{ type: "input_text", text: userPrompt }] }
    ],
    max_output_tokens: MAX_OUTPUT_TOKENS,
    temperature: TEMPERATURE,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "DIYGuide",
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            difficulty: { type: "string" },
            time: { type: "string" },
            tools: { type: "array", items: { type: "string" } },
            materials: { type: "array", items: { type: "string" } },
            steps: { type: "array", items: { type: "string" }, minItems: 6 },
            safety: { type: "array", items: { type: "string" } }
          },
          required: ["title", "steps"]
        }
      }
    }
  };

  let lastErr = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timeoutId;
    if (controller) timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await openai.responses.create({
        ...payload,
        ...(controller ? { signal: controller.signal } : {})
      });

      if (timeoutId) clearTimeout(timeoutId);

      // Debug: log raw response when logger.debug is available
      logger.debug?.("[AI] raw response", response);

      const contentText = extractJsonTextFromResponse(response);
      if (!contentText) {
        lastErr = new Error("No usable content in AI response");
        logger.warn?.("[AI] No usable content found in response; will retry if attempts remain", { attempt });
        if (attempt < MAX_RETRIES) {
          await sleep(300 * Math.pow(2, attempt));
          continue;
        }
        throw lastErr;
      }

      let raw;
      try {
        raw = JSON.parse(contentText);
      } catch (parseErr) {
        lastErr = parseErr;
        logger.warn?.("[AI] JSON parse error. Raw content:", contentText);
        if (attempt < MAX_RETRIES) {
          await sleep(300 * Math.pow(2, attempt));
          continue;
        }
        throw new Error("AI returned invalid JSON");
      }

      const guide = validateGuide(raw, query);

      pruneCacheIfNeeded();
      guideCache.set(norm, { guide, ts: Date.now() });

      logger.info?.(`[AI] Guide generated and cached for: "${norm}"`);
      return guide;
    } catch (err) {
      lastErr = err;
      const isAbort = err?.name === "AbortError" || err?.message?.toLowerCase?.().includes("aborted");
      const isTransient = isAbort || (err?.status >= 500 && err?.status < 600) || err?.code === "ETIMEDOUT";

      logger.error?.("[AI] generateGuideAI attempt failed", { attempt, error: err?.message ?? err });

      if (attempt < MAX_RETRIES && isTransient) {
        await sleep(300 * Math.pow(2, attempt));
        continue;
      }

      break;
    } finally {
      try { if (typeof clearTimeout === "function") clearTimeout?.(); } catch {}
    }
  }

  logger.error?.("[AI] generateGuideAI failed after retries", { error: lastErr?.message ?? lastErr });

  // Fallback minimal guide
  const fallback = validateGuide({}, query);
  return fallback;
}

export default generateGuideAI;
