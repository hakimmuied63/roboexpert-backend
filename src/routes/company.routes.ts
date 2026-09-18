import { Router } from 'express';
import {
  createCompany,
  getMyCompany,
  getCompanyBySlug,
  listCompanies,
} from '../controllers/company.controller.js';
import { requireAuth, requireAdmin, requireSeller } from '../middleware/auth.middleware.js';

const router = Router();

// Public — no auth needed
router.get('/slug/:slug', getCompanyBySlug);

// Seller routes
router.post('/', requireAuth, requireSeller, createCompany);
router.get('/me', requireAuth, requireSeller, getMyCompany);

// Admin routes
router.get('/', requireAuth, requireAdmin, listCompanies);

export default router;