import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateGuideAI(query) {
  const prompt = `
  Create a detailed DIY guide for: "${query}"

  Return JSON with:
  - title
  - difficulty
  - time
  - tools (array)
  - steps (array)
  - safety (array)
  `;

  const response = await client.chat.completions.create({
    model: "gpt-4o",   // ⭐ FIXED MODEL NAME
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  return JSON.parse(response.choices[0].message.content);
}
