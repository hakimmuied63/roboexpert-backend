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
  adminListPendingSellers,
  adminApproveSeller,
  adminRejectSeller,
  adminSuspendSeller,
  adminListCategories,
  adminUpdatePackagingCharge,
} from '../controllers/admin.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { adminListLeads, adminDeleteLead } from '../controllers/lead.controller.js';

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

// Seller Approval
router.get('/sellers', adminListPendingSellers);
router.post('/sellers/:userId/approve', adminApproveSeller);
router.post('/sellers/:userId/reject', adminRejectSeller);
router.post('/sellers/:userId/suspend', adminSuspendSeller);

// Category Packaging Charges
router.get('/categories', adminListCategories);
router.patch('/categories/:categoryId/packaging', adminUpdatePackagingCharge);

// Leads (Lead Capture Popup)
router.get('/leads', adminListLeads);
router.delete('/leads/:leadId', adminDeleteLead);

export default router;