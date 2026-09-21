import { AppError, toAppError } from '../lib/errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Wishlists are keyed by an anonymous per-browser id (no accounts in scope). */
export function requireClientId(req, _res, next) {
  const id = req.get('x-client-id');
  if (!id || !UUID.test(id)) return next(new AppError(400, 'BAD_CLIENT_ID', 'Missing or invalid X-Client-Id header.'));
  req.clientId = id.toLowerCase();
  next();
}

/** Fixed-window per-IP limiter. Simple and dependency-free; swap for Redis-backed if we ever scale out. */
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || h.resetAt <= now) hits.set(req.ip, (h = { count: 0, resetAt: now + windowMs }));
    if (++h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.resetAt - now) / 1000)));
      return next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.'));
    }
    next();
  };
}

export function notFound(_req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Route not found.'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err?.type === 'entity.parse.failed') err = new AppError(400, 'BAD_JSON', 'Invalid JSON body.');
  const appErr = toAppError(err);
  if (appErr.status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(appErr.status).json({ error: { code: appErr.code, message: appErr.message } });
}
