import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import { recalculateProductRating } from '../services/rating.service.js';

// GET /admin/reviews/reported
export const listReportedReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await Review.find({ reported: true })
      .populate('productId', 'name images')
      .populate('reportedBy', 'name email role')
      .sort({ reportedAt: -1 })
      .lean();

    return res.status(200).json({ ok: true, reviews });
  } catch (error) {
    console.error('List reported reviews error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// PATCH /admin/reviews/:reviewId/action
export const handleReportedReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { action } = req.body; // 'hide' or 'dismiss'

    if (!['hide', 'dismiss'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'Invalid action' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ ok: false, error: 'Review not found' });
    }

    if (action === 'hide') {
      review.hidden = true;
    } else if (action === 'dismiss') {
      review.reported = false;
      review.reportedAt = null;
      review.reportedBy = null;
      review.reportedByRole = null;
      review.reportReason = null;
    }

    await review.save();
    await recalculateProductRating(review.productId);

    return res.status(200).json({ ok: true, message: `Review ${action}ed` });
  } catch (error) {
    console.error('Handle reported review error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};