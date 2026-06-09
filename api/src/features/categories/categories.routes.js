import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listCategories,
  createCategory,
  categorySchema,
  updateCategory,
  updateCategorySchema,
  deleteCategory,
} from './categories.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', listCategories);
router.post('/', requireRole('SUPER_ADMIN'), validate(categorySchema), createCategory);
router.patch('/:id', requireRole('SUPER_ADMIN'), validate(updateCategorySchema), updateCategory);
router.delete('/:id', requireRole('SUPER_ADMIN'), deleteCategory);

export default router;
