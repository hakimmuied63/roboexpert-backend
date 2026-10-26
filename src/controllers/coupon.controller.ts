import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';

// ---------- Validation ----------

const createCouponSchema = z.object({
  code: z.string().min(3).toUpperCase().trim(),
  discountType: z.enum(['percentage', 'flat']),
  discountValue: z.number().min(1),
  minOrderAmount: z.number().min(0).default(0),
  maxDiscountAmount: z.number().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isPublic: z.boolean().default(true),
  applicableProducts: z.array(z.string()).default([]),
});

// ---------- SELLER: Create a coupon ----------
export const createCoupon = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller' || !req.user.companyId) {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const parsed = createCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const data = parsed.data;

    // Check if code already exists for this seller
    const existing = await Coupon.findOne({ companyId: req.user.companyId, code: data.code });
    if (existing) {
      return res.status(409).json({ ok: false, error: 'You already have a coupon with this code' });
    }

    const coupon = await Coupon.create({
      companyId: req.user.companyId,
      ...data,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    });

    return res.status(201).json({ ok: true, coupon });
  } catch (error) {
    console.error('Create coupon error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- SELLER: List my coupons ----------
export const listSellerCoupons = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller' || !req.user.companyId) {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const coupons = await Coupon.find({ companyId: req.user.companyId }).sort({ createdAt: -1 });
    return res.status(200).json({ ok: true, coupons });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- SELLER: Delete a coupon ----------
export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller' || !req.user.companyId) {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const { couponId } = req.params;
    const coupon = await Coupon.findOneAndDelete({ _id: couponId, companyId: req.user.companyId });
    
    if (!coupon) return res.status(404).json({ ok: false, error: 'Coupon not found' });
    return res.status(200).json({ ok: true, message: 'Coupon deleted' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- PUBLIC: Validate a coupon for the Cart ----------
export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const { code, companyId, cartTotal } = req.query;

    if (!code || !companyId || !cartTotal) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const coupon = await Coupon.findOne({ 
      companyId: new mongoose.Types.ObjectId(companyId as string), 
      code: (code as string).toUpperCase(),
      isActive: true
    });

    if (!coupon) {
      return res.status(404).json({ ok: false, error: 'Invalid coupon code' });
    }

    // Check expiry
    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      return res.status(400).json({ ok: false, error: 'This coupon has expired' });
    }

    // Check minimum order amount
    const total = Number(cartTotal);
    if (total < coupon.minOrderAmount) {
      return res.status(400).json({ ok: false, error: `Minimum order amount is ₹${coupon.minOrderAmount}` });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (total * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else {
      discount = coupon.discountValue;
    }

    // Ensure discount is not more than total
    if (discount > total) discount = total;

    return res.status(200).json({ 
      ok: true, 
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        applicableProducts: coupon.applicableProducts
      },
      discountAmount: Math.round(discount)
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
// ---------- PUBLIC: Get active public coupons for a seller ----------
export const getPublicCoupons = async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      const coupons = await Coupon.find({
        companyId,
        isActive: true,
        isPublic: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
      }).select('code discountType discountValue minOrderAmount applicableProducts');
      
      return res.status(200).json({ ok: true, coupons });
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
  export const getCartCoupons = async (req: Request, res: Response) => {
    try {
      const { companyIds } = req.body;
      
      if (!companyIds || !Array.isArray(companyIds)) {
        return res.status(400).json({ ok: false, error: 'companyIds array required' });
      }
  
      const coupons = await Coupon.find({
        companyId: { $in: companyIds },
        isActive: true,
        isPublic: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
      }).select('code discountType discountValue minOrderAmount companyId');
  
      return res.status(200).json({ ok: true, coupons });
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };