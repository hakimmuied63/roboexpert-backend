import { Request, Response } from 'express';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import Company from '../models/Company.js';
import { streamInvoicePDF } from '../services/invoice.service.js';

/**
 * GET /orders/track/:orderNumber/invoice?email=...
 *
 * Public — buyer can download their own invoice by proving email.
 */
export const downloadBuyerInvoice = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const email =
      typeof req.query.email === 'string'
        ? req.query.email.trim().toLowerCase()
        : '';

    if (!email) {
      return res
        .status(400)
        .json({ ok: false, error: 'Email is required to download invoice' });
    }

    const order = await Order.findOne({
      orderNumber,
      'buyer.email': email,
    }).lean();

    if (!order) {
      return res
        .status(404)
        .json({ ok: false, error: 'Order not found' });
    }

    const items = await OrderItem.find({ orderId: order._id }).lean();
    const company = await Company.findById(order.companyId).lean();

    await streamInvoicePDF(
      res,
      {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        buyer: order.buyer,
        shippingAddress: order.shippingAddress,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        packagingFee: order.packagingFee ?? 0,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        notes: order.notes,
      },
      items.map((i) => ({
        productSnapshot: {
          name: i.productSnapshot?.name ?? 'Item',
          sku: i.productSnapshot?.sku ?? '',
          variantAttributes: i.productSnapshot?.variantAttributes
            ? Object.fromEntries(
                Object.entries(i.productSnapshot.variantAttributes)
              )
            : {},
        },
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      })),
      {
        sellerName: company?.name ?? 'Seller',
        sellerEmail: company?.contactEmail ?? '',
        sellerPhone: company?.contactPhone,
      }
    );
  } catch (error) {
    console.error('Download invoice error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
};

/**
 * GET /orders/my/:orderId/invoice
 *
 * Seller — can download invoice for their own orders.
 */
export const downloadSellerInvoice = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }

    const { orderId } = req.params;
    const order = await Order.findOne({
      _id: orderId,
      companyId: req.user.companyId,
    }).lean();

    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    const items = await OrderItem.find({ orderId: order._id }).lean();
    const company = await Company.findById(order.companyId).lean();

    await streamInvoicePDF(
      res,
      {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        buyer: order.buyer,
        shippingAddress: order.shippingAddress,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        packagingFee: order.packagingFee ?? 0,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        notes: order.notes,
      },
      items.map((i) => ({
        productSnapshot: {
          name: i.productSnapshot?.name ?? 'Item',
          sku: i.productSnapshot?.sku ?? '',
          variantAttributes: i.productSnapshot?.variantAttributes
            ? Object.fromEntries(
                Object.entries(i.productSnapshot.variantAttributes)
              )
            : {},
        },
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      })),
      {
        sellerName: company?.name ?? 'Seller',
        sellerEmail: company?.contactEmail ?? '',
        sellerPhone: company?.contactPhone,
      }
    );
  } catch (error) {
    console.error('Download seller invoice error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
};