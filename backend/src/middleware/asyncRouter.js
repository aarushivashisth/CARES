import express from 'express';

// Express 4 does not forward rejected async handlers. Register every handler
// through this adapter, preserving normal middleware and error semantics.
export function Router() {
  const router = express.Router();
  const wrap = value => Array.isArray(value) ? value.map(wrap) : typeof value === 'function'
    ? function (req, res, next) { try { Promise.resolve(value(req, res, next)).catch(next); } catch (err) { next(err); } }
    : value;
  for (const method of ['get','post','put','patch','delete','use']) {
    const original = router[method].bind(router);
    router[method] = (...args) => original(...args.map(wrap));
  }
  return router;
}
