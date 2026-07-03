import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden } from '../../utils/AppError.js';
import { effectivePermissions } from './permissions.js';

const ROLES = ['CUSTOMER', 'DEVELOPER', 'ADMIN', 'SUPER_ADMIN'];

const permissionFields = {
  canRaiseTickets: z.boolean().optional(),
  canManageTickets: z.boolean().optional(),
  canViewDashboard: z.boolean().optional(),
  canManageUsers: z.boolean().optional(),
  departmentIds: z.array(z.string()).optional(), // category ids
};

export const createUserSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(ROLES),
    department: z.string().optional(),
    company: z.string().trim().min(1).optional(),
    password: z.string().min(6),
    ...permissionFields,
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
  ...permissionFields,
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
  // Raw grant flags (for the edit form) + resolved effective permissions.
  grants: {
    canRaiseTickets: u.canRaiseTickets,
    canManageTickets: u.canManageTickets,
    canViewDashboard: u.canViewDashboard,
    canManageUsers: u.canManageUsers,
  },
  permissions: effectivePermissions(u),
  departmentIds: u.departments?.map((d) => d.categoryId) || [],
  departments: u.departments?.map((d) => d.category).filter(Boolean) || [],
});

const withDepartments = {
  departments: { include: { category: { select: { id: true, name: true } } } },
};

// Only a Super Admin may create/keep Super Admins or grant "manage users" —
// prevents a delegated user-manager from escalating their own privileges.
function guardEscalation(actor, body) {
  if (actor.role === 'SUPER_ADMIN') return;
  if (body.role === 'SUPER_ADMIN' || body.canManageUsers === true) {
    throw forbidden('Only a Super Admin can grant Super Admin or user-management access');
  }
}

// GET /api/users — list all
export const listUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: withDepartments,
  });
  res.json({ users: users.map(publicUser) });
});

// POST /api/users — create an account, assign a role and permissions
export const createUser = asyncHandler(async (req, res) => {
  guardEscalation(req.user, req.body);
  const {
    name, email, role, department, company, password, departmentIds,
    canRaiseTickets, canManageTickets, canViewDashboard, canManageUsers,
  } = req.body;
  const lowerEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: lowerEmail } });
  if (existing) throw conflict('A user with that email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email: lowerEmail,
      role,
      department,
      company: role === 'CUSTOMER' ? company : null,
      passwordHash,
      canRaiseTickets: canRaiseTickets ?? true,
      canManageTickets: !!canManageTickets,
      canViewDashboard: !!canViewDashboard,
      canManageUsers: !!canManageUsers,
      departments: departmentIds?.length
        ? { create: departmentIds.map((categoryId) => ({ categoryId })) }
        : undefined,
    },
    include: withDepartments,
  });

  res.status(201).json({ user: publicUser(user) });
});

// PATCH /api/users/:id — update role/status/permissions/departments
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound('User not found');
  guardEscalation(req.user, req.body);

  const { departmentIds, password, ...rest } = req.body;
  const data = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  // Replace the department set when the field is provided.
  if (departmentIds) {
    data.departments = {
      deleteMany: {},
      create: departmentIds.map((categoryId) => ({ categoryId })),
    };
  }

  const user = await prisma.user.update({ where: { id }, data, include: withDepartments });
  res.json({ user: publicUser(user) });
});
