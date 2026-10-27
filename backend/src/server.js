import app from './app.js';
import { config } from './config/env.js';
import { initDatabase } from './db/initDb.js';
import { db } from './db/connection.js';
import { logger } from './utils/logger.js';

// Ensure database schema is ready on startup
try {
  initDatabase();
} catch (dbErr) {
  logger.error('Failed to initialize database schema on startup', dbErr);
  process.exit(1);
}

const server = app.listen(config.port, () => {
  logger.info(`🚀 CARES Backend REST API running in [${config.nodeEnv}] mode on port ${config.port}`);
  logger.info(`👉 Health Check: http://localhost:${config.port}/api/health`);
  logger.info(`👉 Allowed CORS Origin: ${config.clientOrigin}`);
});

// Graceful shutdown handling
function handleShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    try {
      db.close();
      logger.info('Database connection closed.');
    } catch (err) {
      logger.error('Error closing database connection', err);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
