import crypto from 'crypto';
import { env } from '../config/env.js';
import { unauthorized, AppError } from '../utils/AppError.js';

// Guards machine-to-machine routes with a shared secret sent as `x-api-key`.
// Compared in constant time to avoid leaking the key via timing.
export function requireApiKey(req, res, next) {
  const configured = env.integration.apiKey;
  if (!configured) {
    return next(new AppError(503, 'Integration API is not configured'));
  }

  const provided = req.get('x-api-key') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(unauthorized('Invalid or missing API key'));
  }
  next();
}
