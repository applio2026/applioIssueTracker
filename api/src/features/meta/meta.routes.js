import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

// GET /api/assignees — staff a manager can assign tickets to
router.get(
  '/assignees',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const assignees = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['DEVELOPER', 'ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true, name: true, role: true, department: true },
      orderBy: { name: 'asc' },
    });
    res.json({ assignees });
  }),
);

export default router;
