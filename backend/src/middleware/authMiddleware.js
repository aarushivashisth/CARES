import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { db } from '../db/connection.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No token provided.',
      code: 'AUTH_TOKEN_MISSING'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = db.get(
      `SELECT id, email, role, status FROM users WHERE id = ?`,
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account not found or has been removed.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `Account is ${user.status}. Please contact administrative support.`,
        code: 'ACCOUNT_INACTIVE'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.',
      code: 'AUTH_TOKEN_INVALID'
    });
  }
}
