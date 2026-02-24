/**
 * Authentication middleware
 * Checks if a user session exists before allowing access to protected routes.
 */
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

module.exports = { requireAuth };
