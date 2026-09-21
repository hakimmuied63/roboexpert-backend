import { Router } from 'express';
import {
  listCompanyProducts,
  getPublicProduct,
} from '../controllers/product.controller.js';

const router = Router();

// Public — no auth
router.get('/companies/:companyId/products', listCompanyProducts);
router.get('/stores/:slug/products/:productId', getPublicProduct);

export default router;