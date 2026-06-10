import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound, forbidden } from '../../utils/AppError.js';
import { generateSsoToken, hashSsoToken } from '../../utils/tokens.js';

// Provision a customer login from a partner application. `company` is required
// (it becomes the label on the user's tickets); `password` is optional — when
// omitted we generate a temporary one and return it once.
export const provisionUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  company: z.string().trim().min(1),
  department: z.string().optional(),
  password: z.string().min(6).optional(),
});

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  company: u.company,
  department: u.department,
  isActive: u.isActive,
  createdAt: u.createdAt,
});

// A reasonably strong, URL-safe temporary password.
const generatePassword = () => crypto.randomBytes(12).toString('base64url');

// POST /api/integration/users — create (or return) a ticket-raising login.
// Idempotent on email so the partner can safely retry: an existing account is
// returned with 200 and is never overwritten.
export const provisionUser = asyncHandler(async (req, res) => {
  const { name, email, company, department, password } = req.body;
  const lowerEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: lowerEmail } });
  if (existing) {
    return res.status(200).json({ created: false, user: publicUser(existing) });
  }

  const tempPassword = password || generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email: lowerEmail,
      role: 'CUSTOMER',
      company,
      department,
      passwordHash,
    },
  });

  res.status(201).json({
    created: true,
    user: publicUser(user),
    // Only present when we generated the password; deliver it to the end user
    // securely — it is not retrievable again.
    ...(password ? {} : { temporaryPassword: tempPassword }),
  });
});

// Enable/disable a login when the partner grants or revokes raise-ticket access.
export const setUserActiveSchema = z.object({
  email: z.string().email(),
  isActive: z.boolean(),
});

// PATCH /api/integration/users — revoke (isActive:false) or restore access.
// Scoped to CUSTOMER logins so the partner cannot disable staff accounts.
export const setUserActive = asyncHandler(async (req, res) => {
  const { email, isActive } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw notFound('No account found for that email');
  if (user.role !== 'CUSTOMER') {
    throw forbidden('Only customer logins can be managed via the integration API');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isActive },
  });
  res.json({ user: publicUser(updated) });
});

// Single-use SSO sign-in tokens, valid for ~60 seconds.
const SSO_TOKEN_TTL_MS = 60 * 1000;

export const ssoTokenSchema = z.object({
  email: z.string().email(),
});

// POST /api/integration/sso-token — issue a one-time sign-in link for a
// provisioned account. The partner redirects the user to the returned URL,
// which logs them into the tracker without a password.
export const createSsoToken = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw notFound('No account found for that email');
  if (!user.isActive) throw forbidden('Account is deactivated');
  if (user.role !== 'CUSTOMER') {
    throw forbidden('SSO sign-in is only available for customer logins');
  }

  const token = generateSsoToken();
  const expiresAt = new Date(Date.now() + SSO_TOKEN_TTL_MS);

  // Housekeeping: drop this user's expired/unused tokens, then store the new one.
  await prisma.$transaction([
    prisma.ssoToken.deleteMany({
      where: { OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }] },
    }),
    prisma.ssoToken.create({
      data: { tokenHash: hashSsoToken(token), userId: user.id, expiresAt },
    }),
  ]);

  res.json({
    url: `${env.clientUrl}/sso?token=${token}`,
    token,
    expiresAt: expiresAt.toISOString(),
  });
});
