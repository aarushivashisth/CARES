import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

/**
 * 404 Not Found handler for undefined API routes
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND'
  });
}

/**
 * Centralized error handling middleware
 */
export function errorHandler(err, req, res, next) {
  logger.error('Request failed', { method:req.method, code:err.code || 'ERROR', status:err.status || 500 });

  const conflict = err.code === '23505' || (err.code === 'ERR_SQLITE_ERROR' && /UNIQUE constraint/i.test(err.message));
  const statusCode = conflict ? 409 : (err.status || err.statusCode || 500);
  const response = {
    success: false,
    error: conflict ? 'A conflicting record already exists.' : statusCode >= 500 && config.nodeEnv !== 'development' ? 'The service could not complete this request.' : (err.message || 'Internal Server Error'),
    code: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : (err.code || 'REQUEST_ERROR')
  };

  if (config.nodeEnv === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
