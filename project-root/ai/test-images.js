import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function test() {
  try {
    const resp = await client.images.generate({
      model: "gpt-image-1",
      prompt: "A clean, realistic thumbnail of someone painting a small bathroom, no text",
      size: "1024x1024"
    });
    console.log("IMAGES RAW:", JSON.stringify(resp, null, 2));
  } catch (e) {
    console.error("IMAGES TEST ERROR:", e);
  }
}
test();
