import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import Company from '../models/Company.js';
import Category from '../models/Category.js';
import { slugify, uniqueSlug } from '../utils/slug.js';

// ---------- Validation ----------

const variantSchema = z.object({
  sku: z.string().min(1).trim(),
  attributes: z.record(z.string()).default({}),
  price: z.number().min(0),
  stock: z.number().int().min(0).default(0),
});

const createProductSchema = z.object({
  name: z.string().min(1).trim(),
  description: z.string().trim().optional(),
  basePrice: z.number().min(0),
  images: z.array(z.string().url()).optional().default([]),
  categoryId: z.string().optional(),
  variants: z.array(variantSchema).min(1, 'At least one variant is required'),
});

const updateProductSchema = z.object({
  name: z.string().min(1).trim().optional(),
  description: z.string().trim().optional(),
  basePrice: z.number().min(0).optional(),
  images: z.array(z.string().url()).optional(),
  categoryId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// ---------- Create product (seller) ----------

export const createProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ ok: false, error: 'Create a company first' });
    }

    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { variants, ...productData } = parsed.data;

    // Unique slug within this company
    const baseSlug = slugify(productData.name);
    const slug = await uniqueSlug(baseSlug, async (candidate) => {
      const found = await Product.findOne({ companyId, slug: candidate });
      return !!found;
    });

    const product = await Product.create({
      ...productData,
      categoryId: productData.categoryId || null,
      slug,
      companyId,
    });

    // Ensure SKUs are unique across the platform before insert
    const skus = variants.map((v) => v.sku);
    const existingSku = await ProductVariant.findOne({ sku: { $in: skus } });
    if (existingSku) {
      await Product.findByIdAndDelete(product._id);
      return res.status(409).json({ ok: false, error: `SKU already exists: ${existingSku.sku}` });
    }

    const createdVariants = await ProductVariant.insertMany(
      variants.map((v) => ({
        ...v,
        productId: product._id,
        companyId,
      }))
    );

    return res.status(201).json({ ok: true, product, variants: createdVariants });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- List products for the logged-in seller ----------

export const listMyProducts = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }
    if (!req.user.companyId) {
      return res.status(400).json({ ok: false, error: 'No company found' });
    }

    const products = await Product.find({ companyId: req.user.companyId }).sort({
      createdAt: -1,
    });
    return res.status(200).json({ ok: true, products });
  } catch (error) {
    console.error('List my products error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Get one product (seller's own) ----------

export const getMyProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ ok: false, error: 'Invalid product ID' });
    }

    const product = await Product.findOne({
      _id: productId,
      companyId: req.user.companyId,
    });
    if (!product) {
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }

    const variants = await ProductVariant.find({ productId: product._id });
    return res.status(200).json({ ok: true, product, variants });
  } catch (error) {
    console.error('Get my product error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Update product (seller) ----------

export const updateProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ ok: false, error: 'Invalid product ID' });
    }

    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const product = await Product.findOneAndUpdate(
      { _id: productId, companyId: req.user.companyId },
      { $set: parsed.data },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }

    return res.status(200).json({ ok: true, product });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Delete product (seller) ----------

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ ok: false, error: 'Invalid product ID' });
    }

    const product = await Product.findOneAndDelete({
      _id: productId,
      companyId: req.user.companyId,
    });
    if (!product) {
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }

    await ProductVariant.deleteMany({ productId: product._id });

    return res.status(200).json({ ok: true, message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- PUBLIC: list products by company ID ----------

export const listCompanyProducts = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ ok: false, error: 'Invalid company ID' });
    }

    const company = await Company.findOne({ _id: companyId, isActive: true });
    if (!company) {
      return res.status(404).json({ ok: false, error: 'Store not found' });
    }

    const products = await Product.find({ companyId, isActive: true }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      ok: true,
      company: { _id: company._id, name: company.name, slug: company.slug },
      products,
    });
  } catch (error) {
    console.error('List company products error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- PUBLIC: get one product by company slug + product ID ----------

export const getPublicProduct = async (req: Request, res: Response) => {
  try {
    const { slug, productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ ok: false, error: 'Invalid product ID' });
    }

    const company = await Company.findOne({ slug, isActive: true });
    if (!company) {
      return res.status(404).json({ ok: false, error: 'Store not found' });
    }

    const product = await Product.findOne({
      _id: productId,
      companyId: company._id,
      isActive: true,
    });
    if (!product) {
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }

    const variants = await ProductVariant.find({
      productId: product._id,
      isActive: true,
    });

    return res.status(200).json({
      ok: true,
      company: { _id: company._id, name: company.name, slug: company.slug },
      product,
      variants,
    });
  } catch (error) {
    console.error('Get public product error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
// ---------- PUBLIC: list all active products (marketplace-wide) ----------

export const listAllPublicProducts = async (_req: Request, res: Response) => {
    try {
      const products = await Product.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(100);
  
      const companyIds = [...new Set(products.map((p) => p.companyId.toString()))];
      const companies = await Company.find({ _id: { $in: companyIds } }).select(
        '_id name slug'
      );
  
      const companyMap: Record<string, { _id: string; name: string; slug: string }> = {};
      companies.forEach((c) => {
        companyMap[c._id.toString()] = {
          _id: c._id.toString(),
          name: c.name,
          slug: c.slug,
        };
      });
  
      const productsWithCompany = products.map((p) => ({
        ...p.toJSON(),
        company: companyMap[p.companyId.toString()] ?? null,
      }));
  
      return res.status(200).json({ ok: true, products: productsWithCompany });
    } catch (error) {
      console.error('List all public products error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
  // ---------- PUBLIC: list all global categories ----------

export const listPublicCategories = async (_req: Request, res: Response) => {
    try {
      const categories = await Category.find({
        isActive: true,
        companyId: null,
      }).sort({ name: 1 });
  
      return res.status(200).json({ ok: true, categories });
    } catch (error) {
      console.error('List public categories error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
  // ---------- PUBLIC: get a single product by ID (with variants + company) ----------

export const getPublicProductById = async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
  
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ ok: false, error: 'Invalid product ID' });
      }
  
      const product = await Product.findOne({ _id: productId, isActive: true });
      if (!product) {
        return res.status(404).json({ ok: false, error: 'Product not found' });
      }
  
      const company = await Company.findById(product.companyId).select('_id name slug');
  
      const variants = await ProductVariant.find({
        productId: product._id,
        isActive: true,
      });
  
      return res.status(200).json({
        ok: true,
        product: {
          ...product.toJSON(),
          company: company
            ? { _id: company._id, name: company.name, slug: company.slug }
            : null,
        },
        variants,
      });
    } catch (error) {
      console.error('Get public product by ID error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
 // ---------- PUBLIC: list products by category slug (across all sellers) ----------

export const listProductsByCategory = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // Find all categories with this slug (from any company)
    const categories = await Category.find({
      slug,
      isActive: true,
    });

    if (categories.length === 0) {
      return res.status(404).json({ ok: false, error: 'Category not found' });
    }

    const categoryIds = categories.map((c) => c._id);

    const products = await Product.find({
      categoryId: { $in: categoryIds },
      isActive: true,
    }).sort({ createdAt: -1 });

    const companyIds = [...new Set(products.map((p) => p.companyId.toString()))];
    const companies = await Company.find({ _id: { $in: companyIds } }).select(
      '_id name slug'
    );

    const companyMap: Record<string, { _id: string; name: string; slug: string }> = {};
    companies.forEach((c) => {
      companyMap[c._id.toString()] = {
        _id: c._id.toString(),
        name: c.name,
        slug: c.slug,
      };
    });

    const productsWithCompany = products.map((p) => ({
      ...p.toJSON(),
      company: companyMap[p.companyId.toString()] ?? null,
    }));

    // Use the first category's name for the header (they all share the slug)
    const displayName = categories[0].name;

    return res.status(200).json({
      ok: true,
      category: { _id: categoryIds[0], name: displayName, slug },
      products: productsWithCompany,
    });
  } catch (error) {
    console.error('List products by category error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
  // ---------- PUBLIC: search products by keyword ----------

export const searchProducts = async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;

    if (!q) {
      return res.status(200).json({ ok: true, products: [] });
    }

    const filter: Record<string, unknown> = {
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ],
    };

    if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
      filter.companyId = companyId;
    }

    const products = await Product.find(filter).sort({ createdAt: -1 }).limit(100);

    const companyIds = [...new Set(products.map((p) => p.companyId.toString()))];
    const companies = await Company.find({ _id: { $in: companyIds } }).select(
      '_id name slug'
    );

    const companyMap: Record<string, { _id: string; name: string; slug: string }> = {};
    companies.forEach((c) => {
      companyMap[c._id.toString()] = {
        _id: c._id.toString(),
        name: c.name,
        slug: c.slug,
      };
    });

    const productsWithCompany = products.map((p) => ({
      ...p.toJSON(),
      company: companyMap[p.companyId.toString()] ?? null,
    }));

    return res.status(200).json({ ok: true, products: productsWithCompany });
  } catch (error) {
    console.error('Search products error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
// ---------- SELLER: bulk create products ----------

const bulkRowSchema = z.object({
  name: z.string().min(1).trim(),
  description: z.string().trim().optional(),
  basePrice: z.number().min(0),
  category: z.string().trim().optional(),
  sku: z.string().min(1).trim(),
  size: z.string().trim().optional(),
  color: z.string().trim().optional(),
  price: z.number().min(0),
  stock: z.number().int().min(0),
  imageUrl: z.string().trim().optional(),
});

const bulkUploadSchema = z.object({
  rows: z.array(bulkRowSchema).min(1, 'At least one row required'),
});

export const bulkCreateProducts = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ ok: false, error: 'Create a company first' });
    }

    const parsed = bulkUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { rows } = parsed.data;

    // Track results per row (1-indexed for user-facing messages)
    const errors: Array<{ row: number; error: string }> = [];
    const validRows: Array<typeof rows[number] & { categoryId: string | null }> = [];

    // Load seller's categories into a lookup map (name → id), case-insensitive
    const sellerCategories = await Category.find({ companyId, isActive: true });
    const categoryMap = new Map<string, string>();
    sellerCategories.forEach((c) => {
      categoryMap.set(c.name.toLowerCase().trim(), c._id.toString());
    });

    // Check SKUs already in the DB (across all companies — SKUs are globally unique)
    const allSkus = rows.map((r) => r.sku);
    const existingVariants = await ProductVariant.find({ sku: { $in: allSkus } });
    const existingSkus = new Set(existingVariants.map((v) => v.sku));

    // Track SKUs within this upload to catch duplicates inside the file
    const seenSkus = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Duplicate SKU inside the file
      if (seenSkus.has(row.sku)) {
        errors.push({ row: rowNum, error: `Duplicate SKU in file: ${row.sku}` });
        continue;
      }

      // SKU already exists in DB
      if (existingSkus.has(row.sku)) {
        errors.push({ row: rowNum, error: `SKU already exists: ${row.sku}` });
        continue;
      }

      // Category lookup (optional — if provided, must exist for this seller)
      let categoryId: string | null = null;
      if (row.category && row.category.trim()) {
        const found = categoryMap.get(row.category.toLowerCase().trim());
        if (!found) {
          errors.push({
            row: rowNum,
            error: `Category not found for your shop: ${row.category}`,
          });
          continue;
        }
        categoryId = found;
      }

      seenSkus.add(row.sku);
      validRows.push({ ...row, categoryId });
    }

    // Group valid rows by product name (products with same name = variants of one product)
    const grouped = new Map<
      string,
      { meta: (typeof validRows)[number]; variants: typeof validRows }
    >();

    for (const row of validRows) {
      const key = row.name.toLowerCase().trim();
      if (!grouped.has(key)) {
        grouped.set(key, { meta: row, variants: [] });
      }
      grouped.get(key)!.variants.push(row);
    }

    const createdProducts: Array<{ _id: string; name: string; variantCount: number }> = [];

    for (const [, group] of grouped) {
      const first = group.meta;

      // Generate a unique slug within the company
      const baseSlug = slugify(first.name);
      const slug = await uniqueSlug(baseSlug, async (candidate) => {
        const found = await Product.findOne({ companyId, slug: candidate });
        return !!found;
      });

      const product = await Product.create({
        companyId,
        categoryId: first.categoryId,
        name: first.name,
        slug,
        description: first.description,
        basePrice: first.basePrice,
        images: first.imageUrl ? [first.imageUrl] : [],
        isActive: true,
      });

      await ProductVariant.insertMany(
        group.variants.map((v) => ({
          productId: product._id,
          companyId,
          sku: v.sku,
          attributes: {
            ...(v.size ? { size: v.size } : {}),
            ...(v.color ? { color: v.color } : {}),
          },
          price: v.price,
          stock: v.stock,
          isActive: true,
        }))
      );

      createdProducts.push({
        _id: product._id.toString(),
        name: product.name,
        variantCount: group.variants.length,
      });
    }

    return res.status(200).json({
      ok: true,
      summary: {
        rowsReceived: rows.length,
        rowsValid: validRows.length,
        rowsFailed: errors.length,
        productsCreated: createdProducts.length,
        variantsCreated: validRows.length,
      },
      products: createdProducts,
      errors,
    });
  } catch (error) {
    console.error('Bulk create products error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};