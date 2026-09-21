import { Router } from 'express';
import {
  placeOrder,
  trackOrder,
  listMyOrders,
  getMyOrder,
  updateOrderStatus,
  listAllOrders,
  getAnyOrder,
} from '../controllers/order.controller.js';
import { requireAuth, requireAdmin, requireSeller } from '../middleware/auth.middleware.js';

const router = Router();

// Public — buyer actions
router.post('/', placeOrder);
router.get('/track/:orderNumber', trackOrder);

// Seller
router.get('/my', requireAuth, requireSeller, listMyOrders);
router.get('/my/:orderId', requireAuth, requireSeller, getMyOrder);
router.patch('/my/:orderId/status', requireAuth, requireSeller, updateOrderStatus);

// Admin
router.get('/', requireAuth, requireAdmin, listAllOrders);
router.get('/:orderId', requireAuth, requireAdmin, getAnyOrder);

export default router;