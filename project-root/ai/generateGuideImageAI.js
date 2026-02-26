// project-root/ai/generateGuideImageAI.js
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateGuideImageAI(query, slug) {
  try {
    const prompt = `Create a clean, realistic DIY thumbnail image representing: "${query}". 
    No text. No words. Just a clear visual.`;

    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      response_format: "b64_json"
    });

    const imageBase64 = response.data[0].b64_json;

    if (!imageBase64) {
      console.error("[AI IMAGE ERROR] No b64_json returned");
      return "/frontend/img/default-guide.jpg";
    }

    const buffer = Buffer.from(imageBase64, "base64");

    // ⭐ FIXED: absolute path
    const outputDir = path.join(process.cwd(), "public", "generated");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const filePath = path.join(outputDir, `${slug}.png`);
    fs.writeFileSync(filePath, buffer);

    // ⭐ FIXED: console.log moved BEFORE return (was unreachable)
    console.log("WROTE FILE:", filePath, fs.existsSync(filePath));

    // ⭐ Return absolute URL for GitHub Pages frontend
    return `https://letsee-1.onrender.com/generated/${slug}.png`;

  } catch (err) {
    console.error("[AI IMAGE ERROR]", err);
    return "/frontend/img/default-guide.jpg";
  }
}
