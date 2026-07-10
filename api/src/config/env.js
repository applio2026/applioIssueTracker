import dotenv from 'dotenv';

// override: values in api/.env beat ambient shell variables (e.g. a PORT
// exported by another project in the same terminal). In production there is
// no .env file — container env vars pass through untouched.
dotenv.config({ override: true });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

// Dev conveniences that must NEVER be used in production. If any of these
// leaks into a prod deploy, anyone who has read the repo can forge tokens.
const DEV_DEFAULTS = {
  JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
  JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
};

// Load a security-critical secret. In production it must be present, long, and
// not one of the well-known dev defaults — otherwise the process refuses to
// boot (fail closed). In development we fall back to the dev default.
function secret(name) {
  const value = process.env[name];
  if (isProd) {
    const weak = !value || value.length < 32 || value === DEV_DEFAULTS[name] || /change[-_]?me/i.test(value);
    if (weak) {
      throw new Error(
        `${name} must be set to a strong secret (32+ chars, not a placeholder) in production. Refusing to start.`,
      );
    }
    return value;
  }
  return value || DEV_DEFAULTS[name];
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET'),
    refreshSecret: secret('JWT_REFRESH_SECRET'),
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  },
  // Shared secret a partner application sends (x-api-key) to provision logins.
  integration: {
    apiKey: process.env.INTEGRATION_API_KEY || '',
  },
  // Extra origins (comma-separated) allowed by CORS — the public marketing
  // sites whose forms post to /api/public/*.
  publicCorsOrigins: (process.env.PUBLIC_CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Tracking System <no-reply@university.edu>',
  },
  seed: {
    email: process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@university.edu',
    password: process.env.SEED_SUPERADMIN_PASSWORD || 'Admin@123',
    name: process.env.SEED_SUPERADMIN_NAME || 'Super Admin',
  },
};
