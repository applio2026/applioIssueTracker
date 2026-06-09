import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound } from '../../utils/AppError.js';

export const categorySchema = z.object({
  name: z.string().min(2),
  defaultTeam: z.string().optional().nullable(),
  defaultSlaHours: z.number().int().min(1).max(2160).default(48),
});

export const updateCategorySchema = categorySchema.partial();

// GET /api/categories — any authenticated user (used by the raise-ticket form)
export const listCategories = asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.json({ categories });
});

// POST /api/categories — Super Admin
export const createCategory = asyncHandler(async (req, res) => {
  const category = await prisma.category.create({ data: req.body });
  res.status(201).json({ category });
});

// PATCH /api/categories/:id — Super Admin
export const updateCategory = asyncHandler(async (req, res) => {
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Category not found');
  const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
  res.json({ category });
});

// DELETE /api/categories/:id — Super Admin. Detaches tickets first to avoid FK errors.
export const deleteCategory = asyncHandler(async (req, res) => {
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Category not found');

  await prisma.$transaction([
    prisma.ticket.updateMany({ where: { categoryId: req.params.id }, data: { categoryId: null } }),
    prisma.category.delete({ where: { id: req.params.id } }),
  ]);
  res.json({ ok: true });
});
