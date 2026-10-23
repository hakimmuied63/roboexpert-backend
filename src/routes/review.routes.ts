import { Router } from 'express';
import {
  listProductReviews,
  createReview,
  reportReview,
  listSellerReviews,
} from '../controllers/review.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Public — no auth required
router.get('/products/:productId/reviews', listProductReviews);
router.post('/products/:productId/reviews', createReview);

// Authenticated
router.post('/reviews/:reviewId/report', requireAuth, reportReview);
router.get('/seller/reviews', requireAuth, listSellerReviews);

export default router;