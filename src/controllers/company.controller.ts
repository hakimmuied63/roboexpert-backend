import { Request, Response } from 'express';
import { z } from 'zod';
import Company from '../models/Company.js';
import User from '../models/User.js';
import { slugify, uniqueSlug } from '../utils/slug.js';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import Order from '../models/Order.js';

// ---------- Validation schema ----------

const createCompanySchema = z.object({
  name: z.string().min(1).trim(),
  contactEmail: z.string().email().toLowerCase().trim(),
  contactPhone: z.string().trim().optional(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  logoUrl: z.string().url().optional(),
});

// ---------- Create company (seller only) ----------

const updateCompanySchema = z.object({
    name: z.string().min(1).trim().optional(),
    contactEmail: z.string().email().toLowerCase().trim().optional(),
    contactPhone: z.string().trim().optional(),
    address: z
      .object({
        line1: z.string().optional(),
        line2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        pincode: z.string().optional(),
        country: z.string().optional(),
      })
      .optional(),
    logoUrl: z.string().url().optional(),
  });

export const createCompany = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    if (req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Only sellers can create companies' });
    }

    const parsed = createCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const existing = await Company.findOne({ ownerUserId: req.user.userId });
    if (existing) {
      return res.status(409).json({ ok: false, error: 'You already have a company' });
    }

    const baseSlug = slugify(parsed.data.name);
    const slug = await uniqueSlug(baseSlug, async (candidate) => {
      const found = await Company.findOne({ slug: candidate });
      return !!found;
    });

    const company = await Company.create({
      ...parsed.data,
      slug,
      ownerUserId: req.user.userId,
    });

    await User.findByIdAndUpdate(req.user.userId, { companyId: company._id });

    return res.status(201).json({ ok: true, company });
  } catch (error) {
    console.error('Create company error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Get my company (seller) ----------

export const getMyCompany = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const company = await Company.findOne({ ownerUserId: req.user.userId });
    if (!company) {
      return res.status(404).json({ ok: false, error: 'No company found' });
    }

    return res.status(200).json({ ok: true, company });
  } catch (error) {
    console.error('Get my company error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Get company by slug (public) ----------

export const getCompanyBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const company = await Company.findOne({ slug, isActive: true });
    if (!company) {
      return res.status(404).json({ ok: false, error: 'Company not found' });
    }

    return res.status(200).json({ ok: true, company });
  } catch (error) {
    console.error('Get company by slug error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- List all companies (admin only) ----------

export const listCompanies = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const companies = await Company.find().sort({ createdAt: -1 });
    return res.status(200).json({ ok: true, companies });
  } catch (error) {
    console.error('List companies error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
// ---------- Update my company (seller) ----------

export const updateMyCompany = async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'seller') {
        return res.status(403).json({ ok: false, error: 'Seller access required' });
      }
  
      const parsed = updateCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }
  
      const company = await Company.findOneAndUpdate(
        { ownerUserId: req.user.userId },
        { $set: parsed.data },
        { new: true }
      );
      if (!company) {
        return res.status(404).json({ ok: false, error: 'No company found' });
      }
  
      return res.status(200).json({ ok: true, company });
    } catch (error) {
      console.error('Update my company error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
  // ---------- Seller dashboard stats ----------

export const getSellerStats = async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'seller') {
        return res.status(403).json({ ok: false, error: 'Seller access required' });
      }
      if (!req.user.companyId) {
        return res.status(400).json({ ok: false, error: 'No company found' });
      }
  
      const companyId = req.user.companyId;
  
      const [totalProducts, activeProducts, totalOrders, pendingOrders, lowStockVariants] =
        await Promise.all([
          Product.countDocuments({ companyId }),
          Product.countDocuments({ companyId, isActive: true }),
          Order.countDocuments({ companyId }),
          Order.countDocuments({ companyId, status: 'placed' }),
          ProductVariant.countDocuments({ companyId, stock: { $lte: 5 }, isActive: true }),
        ]);
  
      const revenueResult = await Order.aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(companyId), paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]);
      const revenue = revenueResult[0]?.total ?? 0;
  
      const ordersByStatus = await Order.aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
  
      return res.status(200).json({
        ok: true,
        stats: {
          totalProducts,
          activeProducts,
          totalOrders,
          pendingOrders,
          lowStockVariants,
          revenue,
          ordersByStatus,
        },
      });
    } catch (error) {
      console.error('Seller stats error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };