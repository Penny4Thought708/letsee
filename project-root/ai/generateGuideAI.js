import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateGuideAI(query) {
  const prompt = `
  Create a detailed DIY guide for: "${query}"

  Return ONLY valid JSON with:
  - title (string)
  - difficulty (string)
  - time (string)
  - tools (array of strings)
  - steps (array of strings)
  - safety (array of strings)
  `;

  const response = await client.responses.create({
    model: "gpt-4o",
    input: prompt,
    response_format: { type: "json_object" }
  });

  const content = response.output[0].content[0].text;
  return JSON.parse(content);
}
