import { Router } from 'express';
import {
  listCompanyProducts,
  listAllPublicProducts,
  listPublicCategories,
  getPublicProduct,
} from '../controllers/product.controller.js';

const router = Router();

// Public — no auth
router.get('/products', listAllPublicProducts);
router.get('/categories', listPublicCategories);
router.get('/companies/:companyId/products', listCompanyProducts);
router.get('/stores/:slug/products/:productId', getPublicProduct);

export default router;