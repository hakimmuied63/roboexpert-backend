import { Router } from 'express';
import {
  adminListCompanies,
  adminGetCompany,
  adminToggleCompanyStatus,
  adminListProducts,
  adminToggleProductStatus,
  adminDeleteProduct,
  adminListUsers,
  adminToggleUserStatus,
  adminStats,
} from '../controllers/admin.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// Every route in this file requires admin
router.use(requireAuth, requireAdmin);

// Dashboard
router.get('/stats', adminStats);

// Companies
router.get('/companies', adminListCompanies);
router.get('/companies/:companyId', adminGetCompany);
router.patch('/companies/:companyId/toggle-status', adminToggleCompanyStatus);

// Products
router.get('/products', adminListProducts);
router.patch('/products/:productId/toggle-status', adminToggleProductStatus);
router.delete('/products/:productId', adminDeleteProduct);

// Users
router.get('/users', adminListUsers);
router.patch('/users/:userId/toggle-status', adminToggleUserStatus);

export default router;