import { Router } from 'express';
import { db } from '../db/connection.js';
import { config } from '../config/env.js';

const router = Router();

router.get('/', (req, res) => {
  let dbStatus = 'connected';
  try {
    db.get('SELECT 1 AS alive');
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }

  res.status(200).json({
    status: 'ok',
    service: 'CARES Healthcare Navigation REST API',
    version: '1.0.0',
    environment: config.nodeEnv,
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

export default router;
