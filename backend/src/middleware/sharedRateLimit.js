import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { db } from '../db/database.js';
import { createAuthRateLimiter } from './rateLimitMiddleware.js';

// One atomic PostgreSQL counter shared across all function instances. Hashed IPs
// and fixed-size windows; expired entries are removed on subsequent requests.
export function sharedRateLimiter(scope,{maxRequests=10,windowMs=900000}={}) {
  const local=createAuthRateLimiter({maxRequests,windowMs});
  return async (req,res,next)=>{
    if (!config.databaseUrl) return local(req,res,next);
    try {
      const now=Date.now();
      const reset=(Math.floor(now/windowMs)+1)*windowMs;
      const hash=crypto.createHmac('sha256',config.jwtSecret).update(req.ip || req.socket?.remoteAddress || 'unknown').digest('hex');
      const key=`${scope}:${hash}:${reset}`;
      const row=await db.get(`WITH expired AS (DELETE FROM rate_limit_counters WHERE expires_at < ?) INSERT INTO rate_limit_counters (key, hits, expires_at) VALUES (?, 1, ?) ON CONFLICT (key) DO UPDATE SET hits = rate_limit_counters.hits + 1 RETURNING hits`,[now,key,reset]);
      const seconds=Math.ceil((reset-now)/1000);
      res.setHeader('RateLimit-Limit',maxRequests);res.setHeader('RateLimit-Remaining',Math.max(0,maxRequests-row.hits));res.setHeader('RateLimit-Reset',seconds);
      if (row.hits>maxRequests) { res.setHeader('Retry-After',seconds);return res.status(429).json({success:false,error:'Too many requests. Try again later.',code:'TOO_MANY_REQUESTS',retryAfterSeconds:seconds}); }
      next();
    } catch(err) { next(err); }
  };
}
