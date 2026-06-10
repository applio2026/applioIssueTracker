import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

// GET /api/assignees — staff that tickets and sub-tasks can be assigned to.
// Open to all authenticated users so any participant can assign sub-tasks.
router.get(
  '/assignees',
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
