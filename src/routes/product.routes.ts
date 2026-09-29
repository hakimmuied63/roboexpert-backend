import { Router } from 'express';
import {
  createProduct,
  bulkCreateProducts,
  listMyProducts,
  getMyProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import { requireAuth, requireSeller } from '../middleware/auth.middleware.js';

const router = Router();

// All routes here require a logged-in seller
router.use(requireAuth, requireSeller);

router.post('/', createProduct);
router.post('/bulk', bulkCreateProducts);
router.get('/me', listMyProducts);
router.get('/me/:productId', getMyProduct);
router.patch('/me/:productId', updateProduct);
router.delete('/me/:productId', deleteProduct);

export default router;