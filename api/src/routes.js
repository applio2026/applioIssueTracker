import { Router } from 'express';
import authRoutes from './features/auth/auth.routes.js';
import userRoutes from './features/users/users.routes.js';
import ticketRoutes from './features/tickets/tickets.routes.js';
import notificationRoutes from './features/notifications/notifications.routes.js';
import dashboardRoutes from './features/dashboard/dashboard.routes.js';
import categoryRoutes from './features/categories/categories.routes.js';
import metaRoutes from './features/meta/meta.routes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tickets', ticketRoutes);
router.use('/notifications', notificationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/categories', categoryRoutes);
router.use('/', metaRoutes); // /assignees

export default router;
