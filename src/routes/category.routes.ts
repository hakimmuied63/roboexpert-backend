import { Router } from 'express';
import {
  listCompanyProducts,
  listAllPublicProducts,
  listPublicCategories,
  listProductsByCategory,
  getPublicProduct,
  getPublicProductById,
} from '../controllers/product.controller.js';
import {
  listCompanyCategoriesPublic,
  listProductsByCompanyCategory,
} from '../controllers/category.controller.js';

const router = Router();

// Public — no auth

// Products
router.get('/products', listAllPublicProducts);
router.get('/products/:productId', getPublicProductById);

// Legacy global categories (kept for now, but no longer used)
router.get('/categories', listPublicCategories);
router.get('/categories/:slug/products', listProductsByCategory);

// Company-scoped categories
router.get('/companies/:companyId/categories', listCompanyCategoriesPublic);
router.get('/companies/:companyId/products', listCompanyProducts);
router.get('/companies/:companyId/categories/:categorySlug/products', listProductsByCompanyCategory);

// Storefront
router.get('/stores/:slug/products/:productId', getPublicProduct);

export default router;