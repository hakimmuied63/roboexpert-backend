import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import { recalculateProductRating } from '../services/rating.service.js';

// ---------- Validation ----------

const guestCreateReviewSchema = z.object({
  orderNumber: z.string().trim().min(1, 'Order number is required'),
  email: z.string().email().toLowerCase().trim(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  images: z.array(z.string().url()).max(3).optional(),
});

const reportReviewSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

// ---------- Helpers ----------

const getPageAndLimit = (req: Request) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
};

// ---------- PUBLIC: List reviews for a product (paginated) ----------

export const listProductReviews = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ ok: false, error: 'Invalid product ID' });
    }

    const { page, limit, skip } = getPageAndLimit(req);

    const filter = {
      productId: new mongoose.Types.ObjectId(productId),
      hidden: false,
    };

    const [reviews, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments(filter),
    ]);

    return res.status(200).json({
      ok: true,
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List reviews error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- PUBLIC: Create a review (Guest flow) ----------

export const createReview = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ ok: false, error: 'Invalid product ID' });
    }

    const parsed = guestCreateReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { orderNumber, email, rating, comment, images } = parsed.data;

    // 1. Verify the order exists, is delivered, and matches the email
    const order = await Order.findOne({
      orderNumber,
      'buyer.email': email,
      status: 'delivered',
    });

    if (!order) {
      return res.status(403).json({
        ok: false,
        error: 'We could not find a delivered order with that order number and email.',
      });
    }

    // 2. Verify this order actually contained this product
    const matchingItem = await OrderItem.findOne({
      orderId: order._id,
      productId: new mongoose.Types.ObjectId(productId),
    });

    if (!matchingItem) {
      return res.status(403).json({
        ok: false,
        error: 'This product was not part of the provided order.',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }

    // 3. Check if this order already reviewed this product (prevent spam)
    const existing = await Review.findOne({
      productId: product._id,
      orderId: order._id,
    });
    if (existing) {
      return res.status(409).json({
        ok: false,
        error: 'A review has already been submitted for this product from this order.',
      });
    }

    // 4. Create the review
    const review = await Review.create({
      productId: product._id,
      companyId: product.companyId,
      buyerId: order._id, // using orderId as the pseudo-buyerId for guest flow uniqueness
      buyerName: order.buyer.name || 'Verified Buyer',
      orderId: order._id,
      rating,
      comment: comment ?? null,
      images: images ?? [],
    });

    await recalculateProductRating(product._id);

    return res.status(201).json({ ok: true, review });
  } catch (error) {
    console.error('Create review error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- AUTH: Report a review ----------

export const reportReview = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const { reviewId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ ok: false, error: 'Invalid review ID' });
    }

    const parsed = reportReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ ok: false, error: 'Review not found' });
    }

    if (review.reported) {
      return res.status(409).json({ ok: false, error: 'Review already reported' });
    }

    review.reported = true;
    review.reportedAt = new Date();
    review.reportedBy = new mongoose.Types.ObjectId(req.user.userId);
    review.reportReason = parsed.data.reason;
    await review.save();

    return res.status(200).json({ ok: true, message: 'Review reported' });
  } catch (error) {
    console.error('Report review error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};