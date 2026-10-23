import { Router } from 'express';
import { listReportedReviews, handleReportedReview } from '../controllers/adminReview.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/reported', listReportedReviews);
router.patch('/:reviewId/action', handleReportedReview);

export default router;