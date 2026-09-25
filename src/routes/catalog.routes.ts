import { Router } from 'express';
import {
  listCompanyProducts,
  listAllPublicProducts,
  listProductsByCategory,
  searchProducts,
  getPublicProduct,
  getPublicProductById,
} from '../controllers/product.controller.js';
import {
  listCompanyCategoriesPublic,
  listProductsByCompanyCategory,
  listMarketplaceCategories,
} from '../controllers/category.controller.js';
import { listActiveCompaniesPublic } from '../controllers/company.controller.js';


const router = Router();

// Public — no auth

// Products
router.get('/products', listAllPublicProducts);
router.get('/products/search', searchProducts);
router.get('/products/:productId', getPublicProductById);

// Legacy global categories (kept for now, but no longer used)
router.get('/categories', listMarketplaceCategories);
router.get('/categories/:slug/products', listProductsByCategory);

// Companies (public list)
router.get('/companies', listActiveCompaniesPublic);

// Company-scoped categories + products
router.get('/companies/:companyId/categories', listCompanyCategoriesPublic);
router.get('/companies/:companyId/products', listCompanyProducts);
router.get('/companies/:companyId/categories/:categorySlug/products', listProductsByCompanyCategory);

// Storefront
router.get('/stores/:slug/products/:productId', getPublicProduct);

export default router;