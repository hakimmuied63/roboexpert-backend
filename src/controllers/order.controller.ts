import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import Company from '../models/Company.js';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import { generateOrderNumber } from '../utils/orderNumber.js';

// ---------- Validation ----------

const placeOrderSchema = z.object({
    buyer: z.object({
    name: z.string().min(1).trim(),
    email: z.string().email().toLowerCase().trim(),
    phone: z.string().min(5).trim(),
  }),
  shippingAddress: z.object({
    line1: z.string().min(1).trim(),
    line2: z.string().trim().optional(),
    city: z.string().min(1).trim(),
    state: z.string().min(1).trim(),
    pincode: z.string().min(1).trim(),
    country: z.string().trim().default('India'),
  }),
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string(),
        quantity: z.number().int().min(1),
      })
    )
    .min(1, 'At least one item required'),
  notes: z.string().trim().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['confirmed', 'shipped', 'delivered', 'cancelled']),
});

// ---------- Helper: unique order number ----------

const createUniqueOrderNumber = async (): Promise<string> => {
  for (let i = 0; i < 5; i++) {
    const candidate = generateOrderNumber();
    const exists = await Order.findOne({ orderNumber: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Could not generate unique order number');
};

// ---------- PUBLIC: Place order ----------
// ---------- PUBLIC: Place order (multi-company carts supported) ----------

export const placeOrder = async (req: Request, res: Response) => {
    try {
      const parsed = placeOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }
  
      const { buyer, shippingAddress, items, notes } = parsed.data;
  
      // Step 1: Validate all items and gather full product/variant info
      type EnrichedItem = {
        product: any;
        variant: any;
        quantity: number;
        lineTotal: number;
        companyId: string;
      };
  
      const enriched: EnrichedItem[] = [];
  
      for (const item of items) {
        if (
          !mongoose.Types.ObjectId.isValid(item.productId) ||
          !mongoose.Types.ObjectId.isValid(item.variantId)
        ) {
          return res.status(400).json({ ok: false, error: 'Invalid product or variant ID' });
        }
  
        const product = await Product.findOne({ _id: item.productId, isActive: true });
        if (!product) {
          return res
            .status(404)
            .json({ ok: false, error: `Product not found or unavailable: ${item.productId}` });
        }
  
        const variant = await ProductVariant.findOne({
          _id: item.variantId,
          productId: product._id,
          isActive: true,
        });
        if (!variant) {
          return res
            .status(404)
            .json({ ok: false, error: `Variant not found: ${item.variantId}` });
        }
  
        if (variant.stock < item.quantity) {
          return res.status(409).json({
            ok: false,
            error: `Insufficient stock for ${variant.sku}. Available: ${variant.stock}`,
          });
        }
  
        enriched.push({
          product,
          variant,
          quantity: item.quantity,
          lineTotal: variant.price * item.quantity,
          companyId: product.companyId.toString(),
        });
      }
  
      // Step 2: Group items by company
      const byCompany: Record<string, EnrichedItem[]> = {};
      for (const item of enriched) {
        if (!byCompany[item.companyId]) byCompany[item.companyId] = [];
        byCompany[item.companyId].push(item);
      }
  
      // Step 3: Create one order per company
      const createdOrders = [];
  
      for (const [companyId, companyItems] of Object.entries(byCompany)) {
        const company = await Company.findOne({ _id: companyId, isActive: true });
        if (!company) {
          return res
            .status(404)
            .json({ ok: false, error: `Store not found: ${companyId}` });
        }
  
        const subtotal = companyItems.reduce((sum, i) => sum + i.lineTotal, 0);
        const shippingFee = 0;
        const total = subtotal + shippingFee;
        const orderNumber = await createUniqueOrderNumber();
  
        const order = await Order.create({
          companyId,
          orderNumber,
          buyer,
          shippingAddress,
          subtotal,
          shippingFee,
          total,
          status: 'placed',
          paymentStatus: 'pending',
          notes,
        });
  
        const createdItems = await OrderItem.insertMany(
          companyItems.map((i) => ({
            orderId: order._id,
            companyId,
            productId: i.product._id,
            variantId: i.variant._id,
            quantity: i.quantity,
            unitPrice: i.variant.price,
            lineTotal: i.lineTotal,
            productSnapshot: {
              name: i.product.name,
              image: i.product.images[0],
              variantAttributes: Object.fromEntries(i.variant.attributes),
              sku: i.variant.sku,
            },
          }))
        );
  
        // Decrement stock for each variant
        for (const i of companyItems) {
          await ProductVariant.findByIdAndUpdate(i.variant._id, {
            $inc: { stock: -i.quantity },
          });
        }
  
        createdOrders.push({
          order,
          items: createdItems,
          company: { _id: company._id, name: company.name, slug: company.slug },
        });
      }
  
      return res.status(201).json({
        ok: true,
        orders: createdOrders,
        message: `Created ${createdOrders.length} order(s)`,
      });
    } catch (error) {
      console.error('Place order error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
  // ---------- PUBLIC: Track order by order number ----------

export const trackOrder = async (req: Request, res: Response) => {
    try {
      const { orderNumber } = req.params;
  
      const order = await Order.findOne({ orderNumber });
      if (!order) {
        return res.status(404).json({ ok: false, error: 'Order not found' });
      }
  
      const items = await OrderItem.find({ orderId: order._id });
  
      return res.status(200).json({ ok: true, order, items });
    } catch (error) {
      console.error('Track order error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
  

// ---------- SELLER: List my orders ----------

export const listMyOrders = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }
    if (!req.user.companyId) {
      return res.status(400).json({ ok: false, error: 'No company found' });
    }

    const orders = await Order.find({ companyId: req.user.companyId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({ ok: true, orders });
  } catch (error) {
    console.error('List my orders error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- SELLER: Get one order ----------

export const getMyOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ ok: false, error: 'Invalid order ID' });
    }

    const order = await Order.findOne({
      _id: orderId,
      companyId: req.user.companyId,
    });
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    const items = await OrderItem.find({ orderId: order._id });

    return res.status(200).json({ ok: true, order, items });
  } catch (error) {
    console.error('Get my order error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- SELLER: Update order status ----------

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ ok: false, error: 'Invalid order ID' });
    }

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const order = await Order.findOneAndUpdate(
      { _id: orderId, companyId: req.user.companyId },
      { $set: { status: parsed.data.status } },
      { new: true }
    );
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    return res.status(200).json({ ok: true, order });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- ADMIN: List all orders ----------

export const listAllOrders = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const orders = await Order.find().sort({ createdAt: -1 }).limit(200);
    return res.status(200).json({ ok: true, orders });
  } catch (error) {
    console.error('List all orders error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- ADMIN: Get any order ----------

export const getAnyOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ ok: false, error: 'Invalid order ID' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    const items = await OrderItem.find({ orderId: order._id });

    return res.status(200).json({ ok: true, order, items });
  } catch (error) {
    console.error('Get any order error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};