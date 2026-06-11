import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// One-time SSO tokens: the random value goes to the partner app; we only
// ever persist its SHA-256 hash.
export const generateSsoToken = () => crypto.randomBytes(32).toString('base64url');
export const hashSsoToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl },
  );
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}
