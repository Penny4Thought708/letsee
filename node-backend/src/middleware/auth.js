import jwt from "jsonwebtoken";
import db from "../db.js";

export default async function authMiddleware(req, res, next) {
  const token =
    req.cookies.token ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) return res.status(401).json({ success: false });

  // Check blacklist
  const blacklisted = await db.query(
    "SELECT 1 FROM token_blacklist WHERE token=$1 LIMIT 1",
    [token]
  );

  if (blacklisted.rowCount > 0) {
    return res.status(401).json({ success: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { user_id: decoded.user_id };
    next();
  } catch {
    return res.status(401).json({ success: false });
  }
}


