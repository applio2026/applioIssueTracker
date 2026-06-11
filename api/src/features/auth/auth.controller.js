import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { badRequest, unauthorized } from '../../utils/AppError.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashSsoToken,
} from '../../utils/tokens.js';
import { createCaptcha, verifyCaptchaAnswer } from './captcha.service.js';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaId: z.string().min(1),
  captchaAnswer: z.union([z.string().min(1), z.number()]),
});

// GET /api/auth/captcha — a fresh math challenge for the login form.
export const getCaptcha = asyncHandler(async (req, res) => {
  res.json(createCaptcha());
});

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
  const { email, password, captchaId, captchaAnswer } = req.body;
  if (!verifyCaptchaAnswer(captchaId, captchaAnswer)) {
    throw badRequest('Security check failed — please answer the new question.');
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) throw unauthorized('Invalid credentials');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized('Invalid credentials');

  res.cookie(REFRESH_COOKIE, signRefreshToken(user), cookieOpts);
  res.json({ accessToken: signAccessToken(user), user: publicUser(user) });
});

export const ssoLoginSchema = z.object({
  token: z.string().min(1),
});

// POST /api/auth/sso — exchange a one-time SSO token (issued via the
// integration API) for a normal session. The token row is deleted on use,
// so it can never be replayed.
export const ssoLogin = asyncHandler(async (req, res) => {
  const tokenHash = hashSsoToken(req.body.token);

  let row;
  try {
    // delete() doubles as the single-use guard: a second attempt finds nothing.
    row = await prisma.ssoToken.delete({
      where: { tokenHash },
      include: { user: true },
    });
  } catch {
    throw unauthorized('Sign-in link is invalid or already used');
  }

  if (row.expiresAt < new Date()) throw unauthorized('Sign-in link has expired');
  if (!row.user.isActive) throw unauthorized('Account inactive');

  res.cookie(REFRESH_COOKIE, signRefreshToken(row.user), cookieOpts);
  res.json({ accessToken: signAccessToken(row.user), user: publicUser(row.user) });
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
