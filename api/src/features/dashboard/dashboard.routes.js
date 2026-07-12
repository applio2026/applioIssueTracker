import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { getStats, exportTickets } from './dashboard.controller.js';

const router = Router();

router.use(requireAuth, requirePermission('canViewDashboard'));

router.get('/stats', getStats);
router.get('/export', exportTickets);

export default router;
