import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listUsers,
  createUser,
  createUserSchema,
  updateUser,
  updateUserSchema,
} from './users.controller.js';

const router = Router();

// User-management routes require the "manage users" permission (Super Admin by
// default; can be granted to others).
router.use(requireAuth, requirePermission('canManageUsers'));

router.get('/', listUsers);
router.post('/', validate(createUserSchema), createUser);
router.patch('/:id', validate(updateUserSchema), updateUser);

export default router;
