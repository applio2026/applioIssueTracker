import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getStats, exportTickets } from './dashboard.controller.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'));

router.get('/stats', getStats);
router.get('/export', exportTickets);

export default router;
