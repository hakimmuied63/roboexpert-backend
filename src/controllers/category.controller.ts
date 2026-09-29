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
// HELPERS
// =====================

type CategoryTree = {
  _id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  productCount?: number;
  children: CategoryTree[];
};

/**
 * Build a nested tree from a flat list of categories.
 * Parents are categories with parentId === null.
 * Children are nested under their parent.
 */
const buildTree = <T extends { _id: any; parentId?: any }>(cats: T[]): any[] => {
  const byId = new Map<string, any>();
  const roots: any[] = [];

  cats.forEach((c) => {
    byId.set(c._id.toString(), { ...c, children: [] });
  });

  cats.forEach((c) => {
    const node = byId.get(c._id.toString());
    const parentIdStr = c.parentId ? c.parentId.toString() : null;
    if (parentIdStr && byId.has(parentIdStr)) {
      byId.get(parentIdStr).children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort roots and children by name
  const sortByName = (arr: any[]) => {
    arr.sort((a, b) => a.name.localeCompare(b.name));
    arr.forEach((item) => sortByName(item.children));
  };
  sortByName(roots);

  return roots;
};

/**
 * Given a category, return its ID plus all descendant category IDs.
 * Only 2 levels deep (parent → children), so this is simple.
 */
const getCategoryAndDescendantIds = async (
  categoryId: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId[]> => {
  const children = await Category.find({ parentId: categoryId }).select('_id');
  const childIds = children.map((c) => c._id);
  return [categoryId, ...childIds];
};

// =====================
// SELLER — own company's categories
// =====================

// ---------- List my company's categories (as a tree) ----------

export const listMyCategories = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }
    if (!req.user.companyId) {
      return res.status(400).json({ ok: false, error: 'No company found' });
    }

    const companyId = req.user.companyId;

    const categories = await Category.find({ companyId });

    // Product count per category (only counts products directly in this category)
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({
          categoryId: cat._id,
          companyId,
        });
        return {
          _id: cat._id.toString(),
          name: cat.name,
          slug: cat.slug,
          parentId: cat.parentId ? cat.parentId.toString() : null,
          isActive: cat.isActive,
          productCount: count,
        };
      })
    );

    const tree = buildTree(withCounts);

    return res.status(200).json({ ok: true, categories: tree });
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

    // Validate parent if provided
    if (parentId) {
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        return res.status(400).json({ ok: false, error: 'Invalid parent ID' });
      }
      const parent = await Category.findOne({
        _id: parentId,
        companyId: req.user.companyId,
      });
      if (!parent) {
        return res
          .status(404)
          .json({ ok: false, error: 'Parent category not found in your shop' });
      }
      // Only 2 levels: parent must itself be top-level
      if (parent.parentId) {
        return res
          .status(400)
          .json({ ok: false, error: 'Cannot nest more than 2 levels deep' });
      }
    }

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

    // If changing parent, validate
    if (parsed.data.parentId) {
      if (parsed.data.parentId === categoryId) {
        return res
          .status(400)
          .json({ ok: false, error: 'A category cannot be its own parent' });
      }
      if (!mongoose.Types.ObjectId.isValid(parsed.data.parentId)) {
        return res.status(400).json({ ok: false, error: 'Invalid parent ID' });
      }
      const parent = await Category.findOne({
        _id: parsed.data.parentId,
        companyId: req.user.companyId,
      });
      if (!parent) {
        return res
          .status(404)
          .json({ ok: false, error: 'Parent category not found in your shop' });
      }
      if (parent.parentId) {
        return res
          .status(400)
          .json({ ok: false, error: 'Cannot nest more than 2 levels deep' });
      }
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

    // Promote children to top-level (non-destructive)
    await Category.updateMany(
      { parentId: category._id },
      { $set: { parentId: null } }
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

// ---------- List a company's categories as a tree (public) ----------

export const listCompanyCategoriesPublic = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ ok: false, error: 'Invalid company ID' });
    }

    const categories = await Category.find({
      companyId,
      isActive: true,
    });

    const flat = categories.map((c) => ({
      _id: c._id.toString(),
      name: c.name,
      slug: c.slug,
      parentId: c.parentId ? c.parentId.toString() : null,
      isActive: c.isActive,
    }));

    const tree = buildTree(flat);

    return res.status(200).json({ ok: true, categories: tree });
  } catch (error) {
    console.error('List company categories public error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};


// ---------- List products by company + category slug (public) ----------
// By default: returns subcategories + products DIRECTLY in this category (no recursion).
// With ?all=true: returns subcategories + products from this category AND all descendants.

export const listProductsByCompanyCategory = async (req: Request, res: Response) => {
    try {
      const { companyId, categorySlug } = req.params;
      const showAll = req.query.all === 'true';
  
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
  
      // Get children (subcategories) of this category
      const children = await Category.find({
        parentId: category._id,
        isActive: true,
      }).sort({ name: 1 });
  
      // Product filter — recursive only if ?all=true
      let categoryIds: mongoose.Types.ObjectId[];
      if (showAll) {
        categoryIds = [category._id, ...children.map((c) => c._id)];
      } else {
        categoryIds = [category._id];
      }
  
      const products = await Product.find({
        companyId,
        categoryId: { $in: categoryIds },
        isActive: true,
      }).sort({ createdAt: -1 });
  
      return res.status(200).json({
        ok: true,
        category: {
          _id: category._id,
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
        },
        subcategories: children.map((c) => ({
          _id: c._id,
          name: c.name,
          slug: c.slug,
        })),
        showAll,
        products,
      });
    } catch (error) {
      console.error('List products by company category error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };

// =====================
// PUBLIC — marketplace-wide
// =====================

// ---------- List all top-level categories across the marketplace ----------

export const listMarketplaceCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await Category.aggregate([
      { $match: { isActive: true, parentId: null } }, // parents only
      {
        $group: {
          _id: '$slug',
          name: { $first: '$name' },
          slug: { $first: '$slug' },
        },
      },
      { $sort: { name: 1 } },
    ]);

    const result = categories.map((c) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
    }));

    return res.status(200).json({ ok: true, categories: result });
  } catch (error) {
    console.error('List marketplace categories error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};