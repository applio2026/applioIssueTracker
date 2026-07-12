import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import routes from './routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Behind the nginx proxy in production — needed so rate limiting sees the
  // real client IP from X-Forwarded-For instead of the proxy's.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Security headers (nosniff, no-referrer, frameguard, HSTS in prod, etc.).
  // This is a JSON API served separately from the SPA, so helmet's defaults
  // are appropriate; disable the API-irrelevant CSP to avoid surprises.
  app.use(helmet({ contentSecurityPolicy: false }));

  // The tracker's own frontend plus any public marketing sites whose forms
  // post to /api/public/* (PUBLIC_CORS_ORIGINS). Non-browser requests (no
  // Origin header) pass through.
  const corsAllowlist = [env.clientUrl, ...env.publicCorsOrigins];
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || corsAllowlist.includes(origin)),
      credentials: true,
    }),
  );
  // Cap JSON body size to blunt memory-exhaustion attempts.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (env.nodeEnv === 'development') app.use(morgan('dev'));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
