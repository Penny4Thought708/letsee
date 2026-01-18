import pool from "../../db.js";

export default async function send(req, res) {
  try {
    const sender_id = req.user.id;
    const { receiver_id, message, file, filename, file_url, transport } = req.body;

    if (!receiver_id || (!message && !file)) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const result = await pool.query(
      `INSERT INTO private_messages 
       (sender_id, receiver_id, message, file, filename, file_url, transport)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        sender_id,
        receiver_id,
        message || "",
        file ? true : false,
        filename || null,
        file_url || null,
        transport || "http",
      ]
    );

    res.json({
      success: true,
      ...result.rows[0],
    });
  } catch (err) {
    console.error("send error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
