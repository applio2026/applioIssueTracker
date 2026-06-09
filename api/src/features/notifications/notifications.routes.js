import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

// GET /api/notifications — recent notifications + unread count for current user
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);
    res.json({ notifications, unread });
  }),
);

// PATCH /api/notifications/read-all — mark everything read
router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  }),
);

// PATCH /api/notifications/:id/read — mark one read
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true },
    });
    res.json({ ok: true });
  }),
);

export default router;
