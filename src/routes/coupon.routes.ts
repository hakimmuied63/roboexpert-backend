import { Router } from 'express';
import {
  createCoupon,
  listSellerCoupons,
  deleteCoupon,
  validateCoupon,
  getPublicCoupons,
  getCartCoupons,
} from '../controllers/coupon.controller.js';
import { requireAuth, requireSeller } from '../middleware/auth.middleware.js';

const router = Router();

// Public
router.get('/public/:companyId', getPublicCoupons);
router.get('/validate', validateCoupon);
router.post('/cart', getCartCoupons);

// Seller only
router.use(requireAuth, requireSeller);
router.post('/', createCoupon);
router.get('/my', listSellerCoupons);
router.delete('/:couponId', deleteCoupon);

export default router;