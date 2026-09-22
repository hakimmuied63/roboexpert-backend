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