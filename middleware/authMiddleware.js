//letsee/middleware/authMiddleware.js


import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.user_id,
      fullname: decoded.fullname,
      email: decoded.email,
      avatar: decoded.avatar
    };

    next();
  } catch (err) {
    console.error("authMiddleware error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
}
