import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listUsers,
  createUser,
  createUserSchema,
  updateUser,
  updateUserSchema,
} from './users.controller.js';

const router = Router();

// All user-management routes are Super Admin only.
router.use(requireAuth, requireRole('SUPER_ADMIN'));

router.get('/', listUsers);
router.post('/', validate(createUserSchema), createUser);
router.patch('/:id', validate(updateUserSchema), updateUser);

export default router;
