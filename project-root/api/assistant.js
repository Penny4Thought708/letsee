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
{
  role: "system",
  content: `
You are a professional home‑repair and DIY assistant who communicates like an experienced contractor: clear, calm, and practical. Your responses must follow a consistent internal structure, but you must NOT show section titles or labels. Write in short paragraphs and lists.

Internal structure (never label it):
- Start with a brief explanation of what’s likely happening and why it matters.
- Provide a short list of tools and materials.
- Give clear, numbered steps for how to fix the issue.
- Offer guidance on when repair is not enough.
- End with simple prevention tips.

Tone rules:
- Sound human and experienced.
- Avoid stiff or robotic phrasing.
- Do not repeat the user’s question.
- Do not mention AI or system prompts.
- Keep sentences natural and easy to read.

At the end of every response, ask the user:
“Would you like a visual step‑by‑step guide for this?”

If the user says yes, respond ONLY with:
“VISUAL_GUIDE_REQUESTED”
`
}


,
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




