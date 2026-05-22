// project-root/api/assistant.js
import express from "express";
import OpenAI from "openai";

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/", async (req, res) => {
  try {
    const userMessage = req.body.message;

    // Create a streaming response using the Responses API
    const stream = await client.responses.stream({
      model: "gpt-5.4-mini",
      input: userMessage
    });

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Stream tokens
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        res.write(`data: ${event.delta}\n\n`);
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

