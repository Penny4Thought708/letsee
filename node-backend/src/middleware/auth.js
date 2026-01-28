// /node-backend/src/middleware/auth.js
// -------------------------------------------------------
// Session‑based authentication middleware
// Works with express-session + connect-pg-simple
// -------------------------------------------------------

export default function authMiddleware(req, res, next) {
  // Ensure session exists
  if (!req.session) {
    return res.status(401).json({ success: false, error: "No session" });
  }

  // Check for logged-in user
  if (!req.session.user_id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  // Expose user_id to downstream routes
  req.user = { user_id: req.session.user_id };

  next();
}




