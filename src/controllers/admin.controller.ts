import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Company from '../models/Company.js';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Category from '../models/Category.js';
import {
  sendSellerApprovedEmail,
  sendSellerRejectedEmail,
  sendSellerSuspendedEmail,
} from '../services/email.service.js';

// =====================
// COMPANIES
// =====================

export const adminListCompanies = async (req: Request, res: Response) => {
  try {
    const { isActive, search } = req.query;

    const filter: Record<string, unknown> = {};
    if (isActive === 'true') filter.isActive = true;
    if (isActive === 'false') filter.isActive = false;
    if (typeof search === 'string' && search.trim()) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    const companies = await Company.find(filter).sort({ createdAt: -1 }).limit(200);
    return res.status(200).json({ ok: true, companies });
  } catch (error) {
    console.error('Admin list companies error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

export const adminGetCompany = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ ok: false, error: 'Invalid company ID' });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ ok: false, error: 'Company not found' });
    }

    const owner = await User.findById(company.ownerUserId).select('email name phone');

    return res.status(200).json({ ok: true, company, owner });
  } catch (error) {
    console.error('Admin get company error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

export const adminToggleCompanyStatus = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ ok: false, error: 'Invalid company ID' });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ ok: false, error: 'Company not found' });
    }

    company.isActive = !company.isActive;
    await company.save();

    return res.status(200).json({ ok: true, company });
  } catch (error) {
    console.error('Admin toggle company error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// =====================
// PRODUCTS
// =====================

export const adminListProducts = async (req: Request, res: Response) => {
  try {
    const { companyId, isActive, search } = req.query;

    const filter: Record<string, unknown> = {};
    if (typeof companyId === 'string' && mongoose.Types.ObjectId.isValid(companyId)) {
      filter.companyId = companyId;
    }
    if (isActive === 'true') filter.isActive = true;
    if (isActive === 'false') filter.isActive = false;
    if (typeof search === 'string' && search.trim()) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    const products = await Product.find(filter).sort({ createdAt: -1 }).limit(200);
    return res.status(200).json({ ok: true, products });
  } catch (error) {
    console.error('Admin list products error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

export const adminToggleProductStatus = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ ok: false, error: 'Invalid product ID' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }

    product.isActive = !product.isActive;
    await product.save();

    return res.status(200).json({ ok: true, product });
  } catch (error) {
    console.error('Admin toggle product error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

export const adminDeleteProduct = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ ok: false, error: 'Invalid product ID' });
    }

    const product = await Product.findByIdAndDelete(productId);
    if (!product) {
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }

    await ProductVariant.deleteMany({ productId: product._id });

    return res.status(200).json({ ok: true, message: 'Product deleted' });
  } catch (error) {
    console.error('Admin delete product error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// =====================
// USERS
// =====================

export const adminListUsers = async (req: Request, res: Response) => {
  try {
    const { role, isActive, search } = req.query;

    const filter: Record<string, unknown> = {};
    if (role === 'admin' || role === 'seller') filter.role = role;
    if (isActive === 'true') filter.isActive = true;
    if (isActive === 'false') filter.isActive = false;
    if (typeof search === 'string' && search.trim()) {
      filter.email = { $regex: search.trim(), $options: 'i' };
    }

    const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
    return res.status(200).json({ ok: true, users });
  } catch (error) {
    console.error('Admin list users error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

export const adminToggleUserStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, error: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ ok: false, error: 'Cannot deactivate an admin' });
    }

    user.isActive = !user.isActive;
    await user.save();

    return res.status(200).json({ ok: true, user });
  } catch (error) {
    console.error('Admin toggle user error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
// =====================
// SELLER APPROVAL
// =====================

// List sellers pending approval (or filter by any status)
export const adminListPendingSellers = async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;

    // Default to 'pending' if not specified
    const targetStatus = (status as string) || 'pending';

    const filter: Record<string, unknown> = {
      role: 'seller',
    };

    if (['pending', 'approved', 'rejected', 'suspended'].includes(targetStatus)) {
      filter.approvalStatus = targetStatus;
    }

    if (typeof search === 'string' && search.trim()) {
      filter.$or = [
        { email: { $regex: search.trim(), $options: 'i' } },
        { name: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('email name phone approvalStatus approvalNote approvedAt createdAt companyId')
      .sort({ createdAt: -1 })
      .limit(200);

    // Get the company name for each seller
    const companyIds = users.map((u) => u.companyId).filter(Boolean);
    const companies = await Company.find({ _id: { $in: companyIds } }).select(
      '_id name slug contactEmail contactPhone'
    );
    const companyMap: Record<string, { _id: string; name: string; slug: string; contactEmail: string; contactPhone?: string }> = {};
    companies.forEach((c) => {
      companyMap[c._id.toString()] = {
        _id: c._id.toString(),
        name: c.name,
        slug: c.slug,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
      };
    });

    const sellers = users.map((u) => ({
      ...u.toJSON(),
      company: u.companyId ? companyMap[u.companyId.toString()] ?? null : null,
    }));

    return res.status(200).json({ ok: true, sellers });
  } catch (error) {
    console.error('Admin list pending sellers error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// Approve a seller
export const adminApproveSeller = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, error: 'Invalid user ID' });
    }

    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    if (user.role !== 'seller') {
      return res.status(400).json({ ok: false, error: 'User is not a seller' });
    }

    user.approvalStatus = 'approved';
    user.approvalNote = null;
    user.approvedAt = new Date();
    user.approvedBy = new mongoose.Types.ObjectId(req.user.userId);
    await user.save();

    // Activate the company too
    let companyName: string | undefined;
    if (user.companyId) {
      const company = await Company.findByIdAndUpdate(
        user.companyId,
        { isActive: true },
        { new: true }
      );
      companyName = company?.name;
    }

    // Fire-and-forget: notify the seller
    sendSellerApprovedEmail({
      name: user.name,
      email: user.email,
      companyName,
    }).catch((err) => {
      console.error('[email] Seller approved email failed:', err);
    });

    return res.status(200).json({ ok: true, user });
  } catch (error) {
    console.error('Admin approve seller error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// Reject a seller (requires reason)
const rejectSellerSchema = z.object({
  reason: z.string().min(1).trim(),
});

export const adminRejectSeller = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, error: 'Invalid user ID' });
    }

    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const parsed = rejectSellerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Rejection reason is required',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    if (user.role !== 'seller') {
      return res.status(400).json({ ok: false, error: 'User is not a seller' });
    }

    user.approvalStatus = 'rejected';
    user.approvalNote = parsed.data.reason;
    user.approvedAt = null;
    user.approvedBy = null;
    await user.save();

    // Deactivate the company too
    if (user.companyId) {
      await Company.findByIdAndUpdate(user.companyId, { isActive: false });
    }

    // Fire-and-forget: notify the seller
    sendSellerRejectedEmail({
      name: user.name,
      email: user.email,
      reason: parsed.data.reason,
    }).catch((err) => {
      console.error('[email] Seller rejected email failed:', err);
    });

    return res.status(200).json({ ok: true, user });
  } catch (error) {
    console.error('Admin reject seller error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// Suspend an approved seller
const suspendSellerSchema = z.object({
  reason: z.string().min(1).trim(),
});

export const adminSuspendSeller = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, error: 'Invalid user ID' });
    }

    const parsed = suspendSellerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Suspension reason is required',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    if (user.role !== 'seller') {
      return res.status(400).json({ ok: false, error: 'User is not a seller' });
    }

    user.approvalStatus = 'suspended';
    user.approvalNote = parsed.data.reason;
    await user.save();

    // Deactivate company
    if (user.companyId) {
      await Company.findByIdAndUpdate(user.companyId, { isActive: false });
    }

    // Fire-and-forget: notify the seller
    sendSellerSuspendedEmail({
      name: user.name,
      email: user.email,
      reason: parsed.data.reason,
    }).catch((err) => {
      console.error('[email] Seller suspended email failed:', err);
    });

    return res.status(200).json({ ok: true, user });
  } catch (error) {
    console.error('Admin suspend seller error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};


// =====================
// CATEGORY PACKAGING CHARGES
// =====================

export const adminListCategories = async (req: Request, res: Response) => {
  try {
    const { search, onlySubcategories } = req.query;

    const filter: Record<string, unknown> = {};
    if (typeof search === 'string' && search.trim()) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }
    if (onlySubcategories === 'true') {
      filter.parentId = { $ne: null };
    }

    const categories = await Category.find(filter)
      .populate('companyId', 'name slug')
      .sort({ name: 1 })
      .limit(500);

    const parentIds = categories
      .map((c) => c.parentId)
      .filter((id): id is any => !!id);
    const parents = parentIds.length
      ? await Category.find({ _id: { $in: parentIds } }).select('_id name')
      : [];
    const parentMap: Record<string, string> = {};
    parents.forEach((p) => {
      parentMap[p._id.toString()] = p.name;
    });

    const enriched = categories.map((c) => ({
      ...c.toJSON(),
      parentName: c.parentId ? parentMap[c.parentId.toString()] ?? null : null,
    }));

    return res.status(200).json({ ok: true, categories: enriched });
  } catch (error) {
    console.error('Admin list categories error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

const updatePackagingSchema = z.object({
  packagingCharge: z.number().min(0),
});

export const adminUpdatePackagingCharge = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ ok: false, error: 'Invalid category ID' });
    }

    const parsed = updatePackagingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const category = await Category.findByIdAndUpdate(
      categoryId,
      { $set: { packagingCharge: parsed.data.packagingCharge } },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ ok: false, error: 'Category not found' });
    }

    return res.status(200).json({ ok: true, category });
  } catch (error) {
    console.error('Admin update packaging error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// =====================
// DASHBOARD STATS
// =====================

export const adminStats = async (_req: Request, res: Response) => {
  try {
    const [companiesCount, activeCompaniesCount, productsCount, ordersCount, usersCount] =
      await Promise.all([
        Company.countDocuments({}),
        Company.countDocuments({ isActive: true }),
        Product.countDocuments({}),
        Order.countDocuments({}),
        User.countDocuments({}),
      ]);

    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const revenue = revenueResult[0]?.total ?? 0;

    const ordersByStatus = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      ok: true,
      stats: {
        companies: companiesCount,
        activeCompanies: activeCompaniesCount,
        products: productsCount,
        orders: ordersCount,
        users: usersCount,
        revenue,
        ordersByStatus,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};