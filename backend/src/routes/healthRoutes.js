import { Router } from '../middleware/asyncRouter.js';
import { db } from '../db/database.js';
import { config } from '../config/env.js';

const router = Router();

router.get('/', async (req, res) => {
  let dbStatus = 'connected';
  try {
    await db.get('SELECT 1 AS alive');
    await db.get('SELECT id FROM users LIMIT 1');
    if (config.databaseUrl && !await db.get("SELECT version FROM schema_migrations WHERE version = '003_rate_limits.sql'")) throw new Error('Schema not ready');
  } catch (err) {
    dbStatus = 'unavailable';
  }

  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: dbStatus === 'connected' ? 'ok' : 'unavailable',
    service: 'CARES Healthcare Navigation REST API',
    version: '1.0.0',
    environment: config.nodeEnv,
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

export default router;
