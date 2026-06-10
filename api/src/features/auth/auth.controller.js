import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { badRequest, unauthorized } from '../../utils/AppError.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/tokens.js';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().min(1, 'Please complete the reCAPTCHA'),
});

// Verify a reCAPTCHA v2 token against Google's siteverify endpoint.
async function verifyCaptcha(token, remoteIp) {
  const body = new URLSearchParams({
    secret: env.recaptcha.secretKey,
    response: token,
  });
  if (remoteIp) body.append('remoteip', remoteIp);

  let data;
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    data = await res.json();
  } catch {
    throw badRequest('Could not verify reCAPTCHA. Please try again.');
  }
  if (!data.success) throw badRequest('reCAPTCHA verification failed. Please try again.');
}

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  department: u.department,
});

const REFRESH_COOKIE = 'refreshToken';
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// POST /api/auth/login  — sign-in only, no public registration
export const login = asyncHandler(async (req, res) => {
  const { email, password, captchaToken } = req.body;
  await verifyCaptcha(captchaToken, req.ip);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) throw unauthorized('Invalid credentials');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized('Invalid credentials');

  res.cookie(REFRESH_COOKIE, signRefreshToken(user), cookieOpts);
  res.json({ accessToken: signAccessToken(user), user: publicUser(user) });
});

// POST /api/auth/refresh — issue a fresh access token from the refresh cookie
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw unauthorized('Invalid refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw unauthorized('Account inactive');

  res.json({ accessToken: signAccessToken(user), user: publicUser(user) });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
  res.json({ ok: true });
});

// GET /api/auth/me — current user
export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw unauthorized();
  res.json({ user: publicUser(user) });
});
