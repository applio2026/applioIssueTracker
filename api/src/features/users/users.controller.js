import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound, conflict } from '../../utils/AppError.js';

const ROLES = ['CUSTOMER', 'DEVELOPER', 'ADMIN', 'SUPER_ADMIN'];

export const createUserSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(ROLES),
    department: z.string().optional(),
    company: z.string().trim().min(1).optional(),
    password: z.string().min(6),
  })
  // Company is mandatory for customers — it becomes the label on their tickets.
  .refine((d) => d.role !== 'CUSTOMER' || !!d.company, {
    message: 'Company name is required for customers',
    path: ['company'],
  });

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(ROLES).optional(),
  department: z.string().nullable().optional(),
  company: z.string().trim().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  department: u.department,
  company: u.company,
  isActive: u.isActive,
  createdAt: u.createdAt,
});

// GET /api/users — list all (Super Admin)
export const listUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ users: users.map(publicUser) });
});

// POST /api/users — create an account and assign a role (Super Admin only)
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, role, department, company, password } = req.body;
  const lowerEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: lowerEmail } });
  if (existing) throw conflict('A user with that email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    // Only customers carry a company; ignore it for staff roles.
    data: { name, email: lowerEmail, role, department, company: role === 'CUSTOMER' ? company : null, passwordHash },
  });

  res.status(201).json({ user: publicUser(user) });
});

// PATCH /api/users/:id — update role/status/details (Super Admin)
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound('User not found');

  const data = { ...req.body };
  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password, 10);
    delete data.password;
  }

  const user = await prisma.user.update({ where: { id }, data });
  res.json({ user: publicUser(user) });
});
