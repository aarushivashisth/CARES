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
  logger.error(`Unhandled error during request [${req.method} ${req.originalUrl}]`, err);

  const statusCode = err.status || err.statusCode || 500;
  const response = {
    success: false,
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_SERVER_ERROR'
  };

  if (config.nodeEnv === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
