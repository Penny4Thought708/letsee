import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function test() {
  try {
    const resp = await client.responses.create({
      model: "gpt-4o",
      input: [
        { role: "system", content: [{ type: "input_text", text: "You are a JSON-only assistant." }] },
        { role: "user", content: [{ type: "input_text", text: "Return {\"hello\":\"world\"} only" }] }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "T",
          schema: { type: "object", properties: { hello: { type: "string" } }, required: ["hello"] }
        }
      }
    });
    console.log("RESPONSES RAW:", JSON.stringify(resp, null, 2));
  } catch (e) {
    console.error("RESPONSES TEST ERROR:", e);
  }
}
test();
