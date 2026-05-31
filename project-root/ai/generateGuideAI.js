// project-root/ai/generateGuideAI.js
/**
 * Production-ready helper to generate DIY guides via the OpenAI Responses API.
 *
 * Features:
 * - Robust parsing of Responses API shapes
 * - Configurable model and timeout via environment variables
 * - Small retry/backoff for transient errors
 * - In-memory TTL cache with optional max size
 * - Defensive validation and sane defaults
 * - Optional logger injection for easier testing and observability
 */

import { openai } from "./openaiClient.js";

/** Cache and configuration */
const guideCache = new Map();
const CACHE_TTL = Number(process.env.GUIDE_CACHE_TTL_MS) || 6 * 60 * 60 * 1000; // default 6 hours
const CACHE_MAX_ENTRIES = Number(process.env.GUIDE_CACHE_MAX) || 500;
const DEFAULT_MODEL = process.env.GUIDE_MODEL || "gpt-4o";
const REQUEST_TIMEOUT_MS =
  Number(process.env.GUIDE_REQUEST_TIMEOUT_MS) || 20_000; // 20s
const MAX_RETRIES = Number(process.env.GUIDE_MAX_RETRIES) || 2;

/** Utility helpers */
function normalizeQuery(q = "") {
  return q.trim().toLowerCase();
}

function isCacheFresh(entry) {
  if (!entry) return false;
  return Date.now() - entry.ts < CACHE_TTL;
}

function pruneCacheIfNeeded() {
  if (guideCache.size <= CACHE_MAX_ENTRIES) return;
  // Simple LRU-ish: remove oldest entries by timestamp
  const entries = Array.from(guideCache.entries());
  entries.sort((a, b) => a[1].ts - b[1].ts);
  const toRemove = entries.slice(0, entries.length - CACHE_MAX_ENTRIES);
  for (const [k] of toRemove) guideCache.delete(k);
}

/**
 * Validate and normalize the raw guide object returned by the model.
 * Ensures required keys exist and applies safe defaults.
 */
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
    ? raw.tools
        .filter((t) => typeof t === "string" && t.trim())
        .map((t) => t.trim())
    : [];

  safe.materials = Array.isArray(raw.materials)
    ? raw.materials
        .filter((m) => typeof m === "string" && m.trim())
        .map((m) => m.trim())
    : [];

  safe.steps = Array.isArray(raw.steps)
    ? raw.steps
        .filter((s) => typeof s === "string" && s.trim())
        .map((s) => s.trim())
    : [];

  safe.safety = Array.isArray(raw.safety)
    ? raw.safety
        .filter((s) => typeof s === "string" && s.trim())
        .map((s) => s.trim())
    : [];

  if (safe.steps.length === 0) {
    safe.steps.push(
      `Research basic steps for "${query}" and plan the project before starting.`,
    );
  }

  if (safe.safety.length === 0) {
    safe.safety.push(
      "Always follow manufacturer instructions and wear appropriate safety gear.",
    );
  }

  if (safe.materials.length === 0) {
    safe.materials.push(
      "Materials will vary depending on the project; confirm quantities before starting.",
    );
  }

  return safe;
}

/**
 * Extract a JSON string from the Responses API output in a defensive way.
 * Supports multiple output shapes the SDK may return.
 */
function extractJsonTextFromResponse(response) {
  if (!response || !Array.isArray(response.output)) return null;

  // Look for a content item that contains parsed JSON first
  for (const out of response.output) {
    if (Array.isArray(out.content)) {
      for (const c of out.content) {
        if (c?.type === "json" && c?.json) {
          return typeof c.json === "string" ? c.json : JSON.stringify(c.json);
        }
        // Some SDKs return JSON as 'application/json' or similar
        if (c?.type === "application/json" && c?.json) {
          return typeof c.json === "string" ? c.json : JSON.stringify(c.json);
        }
      }
    }
  }

  // Fallback: try to find text content
  for (const out of response.output) {
    if (Array.isArray(out.content)) {
      for (const c of out.content) {
        if (
          (c?.type === "output_text" || c?.type === "text") &&
          (c.text || c.content)
        ) {
          return c.text ?? c.content;
        }
      }
    }
    if (typeof out.text === "string" && out.text.trim()) {
      return out.text;
    }
  }

  return null;
}

/**
 * Sleep helper for retries
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main exported function
 *
 * @param {string} query - The user query describing the DIY project
 * @param {object} [opts] - Optional settings
 * @param {object} [opts.logger] - Optional logger with debug/info/warn/error methods
 * @returns {Promise<object>} - Validated guide object
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

  // Build request payload
  const payload = {
    model: DEFAULT_MODEL,
    input: prompt,
    response_format: { type: "json_object" },
  };

  let lastErr = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Timeout via AbortController if supported by SDK
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    let timeoutId;
    if (controller) {
      timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    }

    try {
      const response = await openai.responses.create({
        ...payload,
        // If the SDK supports passing signal, include it
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (timeoutId) clearTimeout(timeoutId);

      const contentText = extractJsonTextFromResponse(response);
      if (!contentText) {
        logger.warn?.(
          "[AI] No usable content found in response; will retry if attempts remain",
          { attempt },
        );
        lastErr = new Error("No usable content in AI response");
        // Retry on transient parse issues
        if (attempt < MAX_RETRIES) {
          await sleep(300 * Math.pow(2, attempt)); // exponential backoff
          continue;
        }
        throw lastErr;
      }

      let raw;
      try {
        raw = JSON.parse(contentText);
      } catch (parseErr) {
        logger.warn?.("[AI] JSON parse error. Raw content:", contentText);
        lastErr = parseErr;
        if (attempt < MAX_RETRIES) {
          await sleep(300 * Math.pow(2, attempt));
          continue;
        }
        throw new Error("AI returned invalid JSON");
      }

      const guide = validateGuide(raw, query);

      // Save to cache (prune if needed)
      pruneCacheIfNeeded();
      guideCache.set(norm, { guide, ts: Date.now() });

      logger.info?.(`[AI] Guide generated and cached for: "${norm}"`);
      return guide;
    } catch (err) {
      lastErr = err;
      // If abort, treat as transient
      const isAbort =
        err?.name === "AbortError" ||
        err?.message?.toLowerCase?.().includes("aborted");
      const isTransient =
        isAbort ||
        (err?.status >= 500 && err?.status < 600) ||
        err?.code === "ETIMEDOUT";

      logger.error?.("[AI] generateGuideAI attempt failed", {
        attempt,
        error: err?.message ?? err,
      });

      if (attempt < MAX_RETRIES && isTransient) {
        await sleep(300 * Math.pow(2, attempt));
        continue;
      }

      // Non-retryable or out of attempts: break and fallback
      break;
    } finally {
      // ensure timeout cleared if controller not used earlier
      try {
        if (typeof clearTimeout === "function") clearTimeout?.();
      } catch {}
    }
  }

  logger.error?.("[AI] generateGuideAI failed after retries", {
    error: lastErr?.message ?? lastErr,
  });

  // Fallback minimal guide so the app never hard-crashes
  const fallback = validateGuide({}, query);
  return fallback;
}

export default generateGuideAI;
