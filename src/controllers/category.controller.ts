import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { slugify, uniqueSlug } from '../utils/slug.js';

// ---------- Validation ----------

const createCategorySchema = z.object({
  name: z.string().min(1).trim(),
  parentId: z.string().nullable().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).trim().optional(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// =====================
// SELLER — own company's categories
// =====================

// ---------- List my company's categories ----------

export const listMyCategories = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }
    if (!req.user.companyId) {
      return res.status(400).json({ ok: false, error: 'No company found' });
    }

    const categories = await Category.find({ companyId: req.user.companyId }).sort({
      name: 1,
    });

    // Add product count per category
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({
          categoryId: cat._id,
          companyId: req.user!.companyId,
        });
        return { ...cat.toJSON(), productCount: count };
      })
    );

    return res.status(200).json({ ok: true, categories: withCounts });
  } catch (error) {
    console.error('List my categories error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Create category ----------

export const createCategory = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }
    if (!req.user.companyId) {
      return res.status(400).json({ ok: false, error: 'Create a company first' });
    }

    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, parentId } = parsed.data;

    const baseSlug = slugify(name);
    const slug = await uniqueSlug(baseSlug, async (candidate) => {
      const found = await Category.findOne({
        companyId: req.user!.companyId,
        slug: candidate,
      });
      return !!found;
    });

    const category = await Category.create({
      name,
      slug,
      companyId: req.user.companyId,
      parentId: parentId ?? null,
    });

    return res.status(201).json({ ok: true, category });
  } catch (error) {
    console.error('Create category error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Update category ----------

export const updateCategory = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const { categoryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ ok: false, error: 'Invalid category ID' });
    }

    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const category = await Category.findOneAndUpdate(
      { _id: categoryId, companyId: req.user.companyId },
      { $set: parsed.data },
      { new: true }
    );
    if (!category) {
      return res.status(404).json({ ok: false, error: 'Category not found' });
    }

    return res.status(200).json({ ok: true, category });
  } catch (error) {
    console.error('Update category error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Delete category ----------

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const { categoryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ ok: false, error: 'Invalid category ID' });
    }

    const category = await Category.findOneAndDelete({
      _id: categoryId,
      companyId: req.user.companyId,
    });
    if (!category) {
      return res.status(404).json({ ok: false, error: 'Category not found' });
    }

    // Detach products that referenced this category
    await Product.updateMany(
      { categoryId: category._id },
      { $set: { categoryId: null } }
    );

    return res.status(200).json({ ok: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// =====================
// PUBLIC — company-scoped views
// =====================

// ---------- List a company's categories (public) ----------

export const listCompanyCategoriesPublic = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ ok: false, error: 'Invalid company ID' });
    }

    const categories = await Category.find({
      companyId,
      isActive: true,
    }).sort({ name: 1 });

    return res.status(200).json({ ok: true, categories });
  } catch (error) {
    console.error('List company categories public error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- List products by company + category slug (public) ----------

export const listProductsByCompanyCategory = async (req: Request, res: Response) => {
  try {
    const { companyId, categorySlug } = req.params;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ ok: false, error: 'Invalid company ID' });
    }

    const category = await Category.findOne({
      companyId,
      slug: categorySlug,
      isActive: true,
    });
    if (!category) {
      return res.status(404).json({ ok: false, error: 'Category not found' });
    }

    const products = await Product.find({
      companyId,
      categoryId: category._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      ok: true,
      category: { _id: category._id, name: category.name, slug: category.slug },
      products,
    });
  } catch (error) {
    console.error('List products by company category error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};