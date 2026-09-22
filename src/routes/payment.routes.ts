import { Router } from 'express';
import {
  createPaymentOrder,
  verifyPayment,
} from '../controllers/payment.controller.js';

const router = Router();

// Public — buyer actions (no auth needed, guest checkout)
router.post('/create-order', createPaymentOrder);
router.post('/verify', verifyPayment);

export default router;