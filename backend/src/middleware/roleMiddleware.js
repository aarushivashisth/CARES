/**
 * Middleware factory enforcing role-based access control (RBAC).
 * Expects `authenticateToken` to have run first and set `req.user`.
 * 
 * @param {string|string[]} allowedRoles Single role or array of authorized roles
 */
export function requireRole(...allowedRoles) {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required prior to authorization check.',
        code: 'UNAUTHENTICATED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Authorized roles: ${roles.join(', ')}. Current role: ${req.user.role}.`,
        code: 'FORBIDDEN_ROLE'
      });
    }

    next();
  };
}
