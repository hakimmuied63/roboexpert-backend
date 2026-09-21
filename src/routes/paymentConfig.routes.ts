import { Router } from 'express';
import {
  savePaymentConfig,
  getMyPaymentConfig,
  deletePaymentConfig,
} from '../controllers/paymentConfig.controller.js';
import { requireAuth, requireSeller } from '../middleware/auth.middleware.js';

const router = Router();

// All routes here require a logged-in seller
router.use(requireAuth, requireSeller);

router.post('/', savePaymentConfig);
router.get('/me', getMyPaymentConfig);
router.delete('/me', deletePaymentConfig);

export default router;