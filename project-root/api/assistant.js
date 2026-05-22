// project-root/api/assistant.js
import express from "express";
import OpenAI from "openai";

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/", async (req, res) => {
  try {
    const userMessage = req.body.message;

    // Create a streaming response using the universal Responses API
    const response = await client.responses.generate({
      model: "gpt-5.4-mini",
      input: userMessage,
      stream: true
    });

    // Convert to a readable stream
    const readable = response.toReadableStream();

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Stream chunks
    for await (const chunk of readable) {
      const text = chunk?.output_text_delta;
      if (text) {
        res.write(`data: ${text}\n\n`);
      }
    }

    res.write("data: [END]\n\n");
    res.end();
  } catch (err) {
    console.error("AI Assistant Error:", err);
    res.status(500).json({ reply: "Server error" });
  }
});
export default router;



