// project-root/api/assistant.js
import express from "express";
import OpenAI from "openai";

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const completion = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        { role: "system", content: "You are a friendly DIY expert assistant." },
        { role: "user", content: userMessage }
      ]
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error("AI Assistant Error:", err);
    res.status(500).json({ reply: "Server error" });
  }
});

export default router;




