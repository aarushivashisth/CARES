/**
 * In-memory Rate Limiting Middleware for Authentication Endpoints.
 *
 * DESIGN NOTES:
 * - Applied narrowly to sensitive authentication endpoints (e.g. login, registration)
 *   to mitigate automated brute-force credential stuffing and denial-of-service attempts.
 * - Per-process in-memory store: suitable for single-node deployments and testing.
 *   In a horizontally scaled multi-instance cluster, a shared backing store (e.g., Redis)
 *   should replace this in-memory map.
 * - IP derivation uses req.ip or client socket address. Express 'trust proxy' is not
 *   enabled by default, preventing spoofing of X-Forwarded-For in direct deployments.
 */

export function createAuthRateLimiter({
  windowMs = 15 * 60 * 1000, // 15 minutes
  maxRequests = process.env.NODE_ENV === 'test' ? 500 : 10, // Generous in test runner, strict in dev/prod
  maxTrackedIps = 10000, // Safety cap to prevent memory exhaustion under distributed scanning
  message = 'Too many authentication attempts from this IP address. Please try again later.',
} = {}) {
  // Map of ip -> { count: number, resetTime: number }
  const requests = new Map();

  // Periodically sweep expired entries to prevent memory leaks
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of requests.entries()) {
      if (now >= record.resetTime) {
        requests.delete(ip);
      }
    }
  }, Math.min(windowMs, 60000));

  // Allow Node process to exit without waiting for the interval timer
  if (sweepInterval.unref) {
    sweepInterval.unref();
  }

  const limiterMiddleware = (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const now = Date.now();

    // Capacity bound: sweep or evict oldest if high-cardinality IP flooding occurs
    if (requests.size >= maxTrackedIps && !requests.has(ip)) {
      for (const [key, item] of requests.entries()) {
        if (now >= item.resetTime) {
          requests.delete(key);
        }
      }
      if (requests.size >= maxTrackedIps) {
        const oldestKey = requests.keys().next().value;
        if (oldestKey) requests.delete(oldestKey);
      }
    }

    let record = requests.get(ip);
    if (!record || now >= record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      requests.set(ip, record);
    }

    record.count += 1;
    const remaining = Math.max(0, maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    // Set standard rate limit headers
    res.setHeader('RateLimit-Limit', maxRequests);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        success: false,
        error: message,
        code: 'TOO_MANY_REQUESTS',
        retryAfterSeconds: resetSeconds,
      });
    }

    next();
  };

  // Helper method for deterministic testing
  limiterMiddleware.reset = () => {
    requests.clear();
  };

  return limiterMiddleware;
}

// Default auth rate limiter instance
export const authRateLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: process.env.NODE_ENV === 'test' ? 500 : 10,
  message: 'Too many authentication attempts. Please wait a few minutes before trying again.',
});
