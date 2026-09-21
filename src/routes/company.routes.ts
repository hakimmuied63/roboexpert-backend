import { Router } from 'express';
import {
  createCompany,
  getMyCompany,
  updateMyCompany,
  getSellerStats,
  getCompanyBySlug,
  listCompanies,
} from '../controllers/company.controller.js';
import { requireAuth, requireAdmin, requireSeller } from '../middleware/auth.middleware.js';

const router = Router();

// Public
router.get('/slug/:slug', getCompanyBySlug);

// Seller routes
router.post('/', requireAuth, requireSeller, createCompany);
router.get('/me', requireAuth, requireSeller, getMyCompany);
router.patch('/me', requireAuth, requireSeller, updateMyCompany);
router.get('/me/stats', requireAuth, requireSeller, getSellerStats);

// Admin routes
router.get('/', requireAuth, requireAdmin, listCompanies);

export default router;