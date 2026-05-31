// project-root/ai/generateGuideAI.js
/**
 * Robust guide generator that works across SDK/API shapes.
 *
 * Behavior:
 * - Prefer Responses API with json_schema (if available).
 * - If the server rejects `response_format`, retry using a strict JSON-only prompt and parse text output.
 * - If the client doesn't expose `openai.responses.create`, fall back to legacy chat completions if available.
 * - Defensive parsing and retries, with cache and validation.
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
 * Try to extract JSON text from various response shapes.
 * Returns a JSON string or null.
 */
function extractJsonTextFromResponse(response) {
  if (!response) return null;

  // Responses API: response.output (array) with content items
  if (Array.isArray(response.output)) {
    for (const out of response.output) {
      // content array shape
      if (Array.isArray(out.content)) {
        for (const c of out.content) {
          // structured json_schema or json content
          if ((c?.type === "json_schema" || c?.type === "json" || c?.type === "application/json") && c?.json) {
            return typeof c.json === "string" ? c.json : JSON.stringify(c.json);
          }
          // parsed or value fields
          if (c?.parsed) return typeof c.parsed === "string" ? c.parsed : JSON.stringify(c.parsed);
          if (c?.value && typeof c.value === "object") return JSON.stringify(c.value);
          // text-like content
          if ((c?.type === "output_text" || c?.type === "text") && (c.text || c.content)) {
            const txt = c.text ?? c.content;
            if (typeof txt === "string" && txt.trim().startsWith("{")) return txt;
          }
        }
      }
      // older SDKs may put text on out.text
      if (typeof out.text === "string" && out.text.trim().startsWith("{")) return out.text;
    }
  }

  // Legacy Chat completions shape: response.choices[0].message.content or response.choices[0].text
  if (Array.isArray(response.choices) && response.choices.length > 0) {
    const first = response.choices[0];
    if (first.message && typeof first.message.content === "string" && first.message.content.trim().startsWith("{")) {
      return first.message.content;
    }
    if (typeof first.text === "string" && first.text.trim().startsWith("{")) {
      return first.text;
    }
  }

  // Some SDKs return top-level 'output_text' or 'text'
  if (typeof response.output_text === "string" && response.output_text.trim().startsWith("{")) return response.output_text;
  if (typeof response.text === "string" && response.text.trim().startsWith("{")) return response.text;

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a strict user prompt that asks for JSON only.
 * This is used as a fallback when json_schema isn't accepted.
 */
function buildStrictJsonPrompt(query) {
  return `
You are a professional DIY home improvement guide generator.

Create a detailed, accurate, step-by-step DIY guide for: "${query}"

Return ONLY valid JSON and nothing else. No commentary, no markdown, no extra text.
The JSON must match this structure:
{
  "title": "string",
  "difficulty": "string",
  "time": "string",
  "tools": ["string", ...],
  "materials": ["string", ...],
  "steps": ["string", ...],
  "safety": ["string", ...]
}

Provide at least 6 actionable steps (prep, painting, cleanup). Example:
{
  "title":"How to paint a small bathroom",
  "difficulty":"Easy",
  "time":"3 hours",
  "tools":["Paint roller","Brush","Drop cloth"],
  "materials":["Interior paint 1 gallon","Painter's tape"],
  "steps":["Prepare the room: remove fixtures, cover floors with drop cloths.","Clean and sand surfaces to be painted.","Apply primer to patched areas and let dry.","Cut in edges with a brush, then roll paint on walls in sections.","Apply a second coat if needed and remove tape while paint is tacky.","Clean up brushes and ventilate the room."],
  "safety":["Wear gloves and eye protection","Ensure good ventilation"]
}
`;
}

/**
 * Main exported function
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

  // Prepare payloads
  const userPrompt = buildStrictJsonPrompt(query);

  // Preferred: Responses API with json_schema
  const responsesSupported = !!(openai && openai.responses && typeof openai.responses.create === "function");

  // Legacy chat fallback detection
  const legacyChatSupported = !!(openai && openai.chat && openai.chat.completions && typeof openai.chat.completions.create === "function");

  let lastErr = null;

  // Helper to call Responses API (optionally with response_format)
  async function callResponses(payload) {
    return await openai.responses.create(payload);
  }

  // Helper to call legacy chat completions
  async function callLegacyChat(promptText) {
    // Many older SDKs expect: model, messages: [{role, content}], max_tokens, temperature
    const messages = [
      { role: "system", content: "You are a professional DIY home improvement guide generator." },
      { role: "user", content: promptText }
    ];
    return await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE
    });
  }

  // Try multiple strategies
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 1) If Responses API is available, try with json_schema first
      if (responsesSupported) {
        try {
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

          const resp = await callResponses(payload);
          logger.debug?.("[AI] raw response (json_schema attempt)", resp);

          const contentText = extractJsonTextFromResponse(resp);
          if (!contentText) throw new Error("No usable content from json_schema response");

          const raw = JSON.parse(contentText);
          const guide = validateGuide(raw, query);
          pruneCacheIfNeeded();
          guideCache.set(norm, { guide, ts: Date.now() });
          logger.info?.(`[AI] Guide generated (json_schema) and cached for: "${norm}"`);
          return guide;
        } catch (err) {
          // If the API rejected response_format, capture and fall through to fallback strategies
          lastErr = err;
          logger.warn?.("[AI] json_schema attempt failed; will try fallback. Error:", err?.message ?? err);
          // If the error indicates unknown parameter, try fallback below
        }
      }

      // 2) If Responses API exists but json_schema failed, try Responses API without response_format (text output)
      if (responsesSupported) {
        try {
          const payload = {
            model: DEFAULT_MODEL,
            input: [
              { role: "system", content: [{ type: "input_text", text: "You are a professional DIY home improvement guide generator." }] },
              { role: "user", content: [{ type: "input_text", text: userPrompt }] }
            ],
            max_output_tokens: MAX_OUTPUT_TOKENS,
            temperature: TEMPERATURE
            // no response_format here
          };

          const resp = await callResponses(payload);
          logger.debug?.("[AI] raw response (text attempt)", resp);

          const contentText = extractJsonTextFromResponse(resp) || (resp.output_text ?? resp.text ?? null);
          if (!contentText) throw new Error("No usable content from responses text output");

          const raw = JSON.parse(contentText);
          const guide = validateGuide(raw, query);
          pruneCacheIfNeeded();
          guideCache.set(norm, { guide, ts: Date.now() });
          logger.info?.(`[AI] Guide generated (responses text) and cached for: "${norm}"`);
          return guide;
        } catch (err) {
          lastErr = err;
          logger.warn?.("[AI] Responses text attempt failed; will try legacy chat if available. Error:", err?.message ?? err);
        }
      }

      // 3) Legacy chat completions fallback
      if (legacyChatSupported) {
        try {
          const resp = await callLegacyChat(userPrompt);
          logger.debug?.("[AI] raw legacy chat response", resp);

          const contentText = extractJsonTextFromResponse(resp) || (resp.choices?.[0]?.message?.content ?? resp.choices?.[0]?.text ?? null);
          if (!contentText) throw new Error("No usable content from legacy chat");

          const raw = JSON.parse(contentText);
          const guide = validateGuide(raw, query);
          pruneCacheIfNeeded();
          guideCache.set(norm, { guide, ts: Date.now() });
          logger.info?.(`[AI] Guide generated (legacy chat) and cached for: "${norm}"`);
          return guide;
        } catch (err) {
          lastErr = err;
          logger.warn?.("[AI] Legacy chat attempt failed. Error:", err?.message ?? err);
        }
      }

      // If none of the above paths are available, throw
      throw new Error("No supported OpenAI method available (responses.create or chat.completions.create)");
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
    }
  }

  logger.error?.("[AI] generateGuideAI failed after retries", { error: lastErr?.message ?? lastErr });

  // Fallback minimal guide
  const fallback = validateGuide({}, query);
  return fallback;
}

export default generateGuideAI;
