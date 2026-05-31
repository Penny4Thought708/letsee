// project-root/ai/generateGuideImageAI.js
/**
 * Generate a thumbnail image for a guide using the OpenAI Images API.
 *
 * Notes:
 * - Do NOT pass `response_format` to the images call (some SDKs / API versions reject it).
 * - The modern SDK returns either `data[0].b64_json` or `data[0].url` depending on account/options.
 * - This file uses the shared OpenAI client from openaiClient.js so credentials/config are centralized.
 */

import { openai } from "./openaiClient.js";
import fs from "fs";
import path from "path";

const DEFAULT_IMAGE_PATH = "/frontend/img/default-guide.jpg";
const OUTPUT_DIR = path.join(process.cwd(), "public", "generated");

async function ensureOutputDir() {
  try {
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (e) {
    // ignore - we'll handle write errors later
  }
}

/**
 * Generate and persist a guide thumbnail.
 *
 * @param {string} query - Short description used to prompt the image model.
 * @param {string} slug - File-safe identifier used for the output filename.
 * @returns {Promise<string>} - Public URL to the generated image or a default image path on error.
 */
export async function generateGuideImageAI(query, slug) {
  try {
    if (!query || typeof query !== "string") {
      throw new TypeError("generateGuideImageAI: query must be a non-empty string");
    }
    if (!slug || typeof slug !== "string") {
      throw new TypeError("generateGuideImageAI: slug must be a non-empty string");
    }

    const prompt = `Create a clean, realistic DIY thumbnail image representing: "${query}". No text, no logos, no words — just a clear visual that communicates the project. Use natural lighting and a simple composition.`;

    // Call the images API without response_format parameter
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024"
    });

    // The SDK may return either a base64 payload or a URL
    const b64 = response?.data?.[0]?.b64_json;
    const url = response?.data?.[0]?.url;

    if (!b64 && !url) {
      console.error("[AI IMAGE ERROR] No image data returned from API", { response });
      return DEFAULT_IMAGE_PATH;
    }

    // If we got a URL, return it directly (no file write)
    if (url && typeof url === "string") {
      // Optionally, you could download and cache the URL locally here.
      return url;
    }

    // Otherwise, write the base64 image to disk and return the public URL
    await ensureOutputDir();

    const buffer = Buffer.from(b64, "base64");
    const filename = `${slug}.png`;
    const filePath = path.join(OUTPUT_DIR, filename);

    await fs.promises.writeFile(filePath, buffer);

    // Construct a public URL that matches your hosting setup
    // Adjust the base URL if your deployment uses a different domain or path.
    const baseUrl = process.env.PUBLIC_BASE_URL || "https://letsee-1.onrender.com";
    const publicUrl = `${baseUrl}/generated/${encodeURIComponent(filename)}`;

    console.log("[AI IMAGE] Wrote file:", filePath);
    return publicUrl;
  } catch (err) {
    console.error("[AI IMAGE ERROR]", err);
    return DEFAULT_IMAGE_PATH;
  }
}

export default generateGuideImageAI;
