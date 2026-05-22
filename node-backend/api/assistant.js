// project-root/api/assistant.js
import express from "express";
import OpenAI from "openai";

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        { role: "system", content: "You are a friendly DIY expert assistant." },
        { role: "user", content: userMessage }
      ]
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content;
      if (token) {
        res.write(`data: ${token}\n\n`);
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
