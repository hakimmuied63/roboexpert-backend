import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import Company from '../models/Company.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import { generateOrderNumber } from '../utils/orderNumber.js';
import { refundRazorpayPayment } from '../services/razorpay.service.js';
import {
  sendOrderConfirmationToBuyer,
  sendNewOrderToSeller,
  sendOrderShippedToBuyer,
  sendOrderDeliveredToBuyer,
  sendOrderCancelledToBuyer,
  sendOrderCancelledToSeller,
  sendReturnRequestedToSeller,
} from '../services/email.service.js';

// ---------- Validation ----------
const utmSchema = z
  .object({
    source: z.string().max(200).trim().optional(),
    medium: z.string().max(200).trim().optional(),
    campaign: z.string().max(200).trim().optional(),
    term: z.string().max(200).trim().optional(),
    content: z.string().max(200).trim().optional(),
    landingPage: z.string().max(500).trim().optional(),
    referrer: z.string().max(500).trim().optional(),
  })
  .optional();

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
  paymentMethod: z.enum(['cod', 'online']).default('online'),
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
  utm: utmSchema,
});

const updateStatusSchema = z.object({
  status: z.enum(['confirmed', 'shipped', 'delivered', 'cancelled']),
});

// ---------- Helper: build the email payload for an order ----------
const buildOrderEmailData = (order: any, items: any[], company: any) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const trackUrl = `${frontendUrl}/track-order?order=${order.orderNumber}`;
  const cancelUrl = `${frontendUrl}/track-order?order=${order.orderNumber}&email=${encodeURIComponent(order.buyer.email)}&action=cancel`;

  return {
    orderNumber: order.orderNumber,
    buyerName: order.buyer?.name ?? 'Customer',
    buyerEmail: order.buyer?.email ?? '',
    sellerName: company.name,
    sellerEmail: company.contactEmail,
    items: items.map((i) => ({
      name: i.productSnapshot?.name ?? 'Item',
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    shippingAddress: order.shippingAddress,
    trackUrl,
    cancelUrl,
  };
};

// ---------- Helper: unique order number ----------

const createUniqueOrderNumber = async (): Promise<string> => {
  for (let i = 0; i < 5; i++) {
    const candidate = generateOrderNumber();
    const exists = await Order.findOne({ orderNumber: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Could not generate unique order number');
};

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

    const { buyer, shippingAddress, items, notes, paymentMethod, utm } = parsed.data;

    type EnrichedItem = {
      product: any;
      variant: any;
      quantity: number;
      lineTotal: number;
      companyId: string;
      categoryId: string | null;
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
        categoryId: product.categoryId ? product.categoryId.toString() : null,
      });
    }

    const byCompany: Record<string, EnrichedItem[]> = {};
    for (const item of enriched) {
      if (!byCompany[item.companyId]) byCompany[item.companyId] = [];
      byCompany[item.companyId].push(item);
    }

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

      const uniqueCategoryIds = [
        ...new Set(
          companyItems
            .map((i) => i.categoryId)
            .filter((id): id is string => !!id)
        ),
      ];

      let packagingFee = 0;

      if (uniqueCategoryIds.length > 0) {
        const categories = await Category.find({
          _id: { $in: uniqueCategoryIds },
        });

        const parentIds = [
          ...new Set(
            categories
              .map((c) => c.parentId?.toString())
              .filter((id): id is string => !!id)
          ),
        ];
        const parents = parentIds.length
          ? await Category.find({ _id: { $in: parentIds } })
          : [];
        const parentMap: Record<string, any> = {};
        parents.forEach((p) => {
          parentMap[p._id.toString()] = p;
        });

        for (const cat of categories) {
          let charge = cat.packagingCharge ?? 0;
          if (!charge && cat.parentId) {
            const parent = parentMap[cat.parentId.toString()];
            charge = parent?.packagingCharge ?? 0;
          }
          packagingFee += charge;
        }
      }

      const total = subtotal + shippingFee + packagingFee;
      const orderNumber = await createUniqueOrderNumber();

      const order = await Order.create({
        companyId,
        orderNumber,
        buyer,
        shippingAddress,
        subtotal,
        shippingFee,
        packagingFee,
        total,
        status: 'placed',
        paymentMethod,
        paymentStatus: 'pending',
        notes,
        utm,
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

      for (const i of companyItems) {
        await ProductVariant.findByIdAndUpdate(i.variant._id, {
          $inc: { stock: -i.quantity },
        });
      }

      const emailData = buildOrderEmailData(order, createdItems, company);

      if (paymentMethod === 'cod' || order.paymentStatus === 'paid') {
        Promise.all([
          sendOrderConfirmationToBuyer(emailData),
          sendNewOrderToSeller(emailData),
        ]).catch((err) => {
          console.error('[email] Order notification failed:', err);
        });
      } else {
        sendNewOrderToSeller(emailData).catch((err) => {
          console.error('[email] Seller new-order email failed:', err);
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
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';

    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email is required to look up an order' });
    }

    const order = await Order.findOne({
      orderNumber,
      'buyer.email': email,
    });

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: 'No order found with that order number and email',
      });
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

    const existing = await Order.findOne({
      _id: orderId,
      companyId: req.user.companyId,
    }).select('status');
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    const previousStatus = existing.status;

    const order = await Order.findOneAndUpdate(
      { _id: orderId, companyId: req.user.companyId },
      { $set: { status: parsed.data.status } },
      { new: true }
    );
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    const newStatus = parsed.data.status;

    if (previousStatus !== newStatus) {
      (async () => {
        try {
          const items = await OrderItem.find({ orderId: order._id });
          const company = await Company.findById(order.companyId);
          if (!company) return;

          const emailData = buildOrderEmailData(order, items, company);

          if (newStatus === 'shipped') {
            await sendOrderShippedToBuyer(emailData);
          } else if (newStatus === 'delivered') {
            await sendOrderDeliveredToBuyer(emailData);
          } else if (newStatus === 'cancelled') {
            await Promise.all([
              sendOrderCancelledToBuyer(
                emailData,
                order.cancellationReason ?? undefined
              ),
              sendOrderCancelledToSeller(
                emailData,
                order.cancellationReason ?? undefined
              ),
            ]);
          }
        } catch (err) {
          console.error('[email] Status-change notification failed:', err);
        }
      })();
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

// ---------- PUBLIC: Cancel an order (buyer, verified by email) ----------

const cancelOrderSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  reason: z.string().min(1).trim(),
  note: z.string().trim().optional(),
});

export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const parsed = cancelOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, reason, note } = parsed.data;

    const order = await Order.findOne({
      orderNumber,
      'buyer.email': email,
    });

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: 'No order found with that order number and email',
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ ok: false, error: 'Order is already cancelled' });
    }
    if (order.status === 'shipped' || order.status === 'delivered') {
      return res.status(400).json({
        ok: false,
        error: `Order cannot be cancelled once it's ${order.status}`,
      });
    }

    let refundAttempted = false;
    let refundSucceeded = false;
    let refundErrorMessage: string | null = null;

    if (
      order.paymentMethod === 'online' &&
      order.paymentStatus === 'paid' &&
      order.razorpayPaymentId
    ) {
      refundAttempted = true;
      try {
        const result = await refundRazorpayPayment(
          order.companyId.toString(),
          order.razorpayPaymentId,
          order.total
        );
        order.refundStatus = 'completed';
        order.refundId = result.refundId;
        order.refundAmount = result.amount;
        order.refundedAt = new Date();
        order.refundFailureReason = null;
        order.paymentStatus = 'refunded';
        refundSucceeded = true;
      } catch (err) {
        refundErrorMessage = err instanceof Error ? err.message : 'Refund failed';
        console.error('[refund] Cancel refund failed:', refundErrorMessage);
        order.refundStatus = 'failed';
        order.refundFailureReason = refundErrorMessage;
      }
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    order.cancellationNote = note ?? null;
    await order.save();

    const items = await OrderItem.find({ orderId: order._id });
    for (const item of items) {
      await ProductVariant.findByIdAndUpdate(item.variantId, {
        $inc: { stock: item.quantity },
      });
    }

    (async () => {
      try {
        const company = await Company.findById(order.companyId);
        if (!company) return;

        const emailData = buildOrderEmailData(order, items, company);
        const reasonText = reason || order.cancellationReason || undefined;

        await Promise.all([
          sendOrderCancelledToBuyer(emailData, reasonText),
          sendOrderCancelledToSeller(emailData, reasonText),
        ]);
      } catch (err) {
        console.error('[email] Cancellation notification failed:', err);
      }
    })();

    return res.status(200).json({
      ok: true,
      order,
      refund: refundAttempted
        ? {
            attempted: true,
            succeeded: refundSucceeded,
            error: refundErrorMessage,
          }
        : { attempted: false },
      message: refundSucceeded
        ? 'Order cancelled and refund issued'
        : refundAttempted
        ? 'Order cancelled, but refund failed — seller will retry manually'
        : 'Order cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- PUBLIC: Request return (buyer, verified by email) ----------

const requestReturnSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  reason: z.string().min(1).trim(),
  note: z.string().trim().optional(),
});

export const requestReturn = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const parsed = requestReturnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, reason, note } = parsed.data;

    const order = await Order.findOne({
      orderNumber,
      'buyer.email': email,
    });

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: 'No order found with that order number and email',
      });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        ok: false,
        error: 'Returns can only be requested for delivered orders',
      });
    }

    if (order.returnStatus) {
      return res.status(400).json({
        ok: false,
        error: `Return already ${order.returnStatus}`,
      });
    }

    const deliveredAt = order.updatedAt ?? order.createdAt;
    const daysSinceDelivery =
      (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDelivery > 7) {
      return res.status(400).json({
        ok: false,
        error: 'Return window has expired (7 days from delivery)',
      });
    }

    order.returnStatus = 'requested';
    order.returnReason = reason;
    order.returnNote = note ?? null;
    order.returnRequestedAt = new Date();
    await order.save();

    (async () => {
      try {
        const items = await OrderItem.find({ orderId: order._id });
        const company = await Company.findById(order.companyId);
        if (!company) return;

        const emailData = buildOrderEmailData(order, items, company);
        const reasonText = note ? `${reason} — ${note}` : reason;

        await sendReturnRequestedToSeller(emailData, reasonText);
      } catch (err) {
        console.error('[email] Return-requested notification failed:', err);
      }
    })();

    return res.status(200).json({
      ok: true,
      order,
      message: 'Return requested successfully. The seller will review your request.',
    });
  } catch (error) {
    console.error('Request return error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
// ---------- SELLER: Update return status (approve / reject / received) ----------

const updateReturnStatusSchema = z.object({
  action: z.enum(['approve', 'reject', 'received']),
  note: z.string().trim().optional(),
});

export const updateReturnStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ ok: false, error: 'Invalid order ID' });
    }

    const parsed = updateReturnStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { action, note } = parsed.data;

    const order = await Order.findOne({
      _id: orderId,
      companyId: req.user.companyId,
    });
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    // ---------- Guard: action must match current state ----------
    if (action === 'approve' || action === 'reject') {
      if (order.returnStatus !== 'requested') {
        return res.status(400).json({
          ok: false,
          error: `Cannot ${action} — return is currently '${order.returnStatus ?? 'none'}'`,
        });
      }
    }

    if (action === 'received') {
      if (order.returnStatus !== 'approved') {
        return res.status(400).json({
          ok: false,
          error: `Cannot mark received — return must be 'approved' first (current: '${order.returnStatus ?? 'none'}')`,
        });
      }
    }

    // ---------- Apply action ----------
    if (action === 'approve') {
      order.returnStatus = 'approved';
      order.returnResolvedAt = new Date();
      if (note) order.returnNote = note;
      await order.save();

      return res.status(200).json({
        ok: true,
        order,
        message: 'Return approved. Waiting for item to be received.',
      });
    }

    if (action === 'reject') {
      order.returnStatus = 'rejected';
      order.returnResolvedAt = new Date();
      if (note) order.returnNote = note;
      await order.save();

      return res.status(200).json({
        ok: true,
        order,
        message: 'Return rejected.',
      });
    }

    // ---------- action === 'received' : complete return + refund ----------
    let refundAttempted = false;
    let refundSucceeded = false;
    let refundErrorMessage: string | null = null;

    if (
      order.paymentMethod === 'online' &&
      order.paymentStatus === 'paid' &&
      order.razorpayPaymentId
    ) {
      refundAttempted = true;
      try {
        const result = await refundRazorpayPayment(
          order.companyId.toString(),
          order.razorpayPaymentId,
          order.total
        );
        order.refundStatus = 'completed';
        order.refundId = result.refundId;
        order.refundAmount = result.amount;
        order.refundedAt = new Date();
        order.refundFailureReason = null;
        order.paymentStatus = 'refunded';
        refundSucceeded = true;
      } catch (err) {
        refundErrorMessage = err instanceof Error ? err.message : 'Refund failed';
        console.error('[refund] Return refund failed:', refundErrorMessage);
        order.refundStatus = 'failed';
        order.refundFailureReason = refundErrorMessage;
      }
    }

    order.returnStatus = 'completed';
    order.returnResolvedAt = new Date();
    if (note) order.returnNote = note;
    await order.save();

    // Restore stock — buyer sent the item back, so it goes back into inventory
    const items = await OrderItem.find({ orderId: order._id });
    for (const item of items) {
      await ProductVariant.findByIdAndUpdate(item.variantId, {
        $inc: { stock: item.quantity },
      });
    }

    return res.status(200).json({
      ok: true,
      order,
      refund: refundAttempted
        ? {
            attempted: true,
            succeeded: refundSucceeded,
            error: refundErrorMessage,
          }
        : { attempted: false },
      message: refundSucceeded
        ? 'Return completed and refund issued'
        : refundAttempted
        ? 'Return completed, but refund failed — retry manually from Razorpay dashboard'
        : 'Return completed (COD — no refund needed)',
    });
  } catch (error) {
    console.error('Update return status error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};