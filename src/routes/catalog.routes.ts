import { Router } from 'express';
import {
  listCompanyProducts,
  listAllPublicProducts,
  listPublicCategories,
  listProductsByCategory,
  getPublicProduct,
  getPublicProductById,
} from '../controllers/product.controller.js';

const router = Router();

// Public — no auth
router.get('/products', listAllPublicProducts);
router.get('/products/:productId', getPublicProductById);
router.get('/categories', listPublicCategories);
router.get('/categories/:slug/products', listProductsByCategory);
router.get('/companies/:companyId/products', listCompanyProducts);
router.get('/stores/:slug/products/:productId', getPublicProduct);

export default router;