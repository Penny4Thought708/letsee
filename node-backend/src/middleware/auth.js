import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  const token =
    req.cookies.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { user_id: decoded.user_id };
    next();
  } catch {
    return res.status(401).json({ success: false });
  }
}
