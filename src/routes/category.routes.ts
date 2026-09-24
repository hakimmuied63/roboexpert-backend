import { Router } from 'express';
import {
  listMyCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';
import { requireAuth, requireSeller } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require a logged-in seller
router.use(requireAuth, requireSeller);

router.get('/me', listMyCategories);
router.post('/', createCategory);
router.patch('/:categoryId', updateCategory);
router.delete('/:categoryId', deleteCategory);

export default router;