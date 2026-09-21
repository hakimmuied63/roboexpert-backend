import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Company from '../models/Company.js';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import User from '../models/User.js';
import Order from '../models/Order.js';

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