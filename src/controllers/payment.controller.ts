import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import SellerPaymentConfig from '../models/SellerPaymentConfig.js';
import { createRazorpayOrder } from '../services/razorpay.service.js';
import { decrypt } from '../utils/encryption.js';
import OrderItem from '../models/OrderItem.js';
import Company from '../models/Company.js';
import {
  sendOrderConfirmationToBuyer,
  sendNewOrderToSeller,
} from '../services/email.service.js';
// ---------- Validation ----------

const createPaymentOrderSchema = z.object({
  orderId: z.string(),
});

const verifyPaymentSchema = z.object({
  orderId: z.string(),
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

// ---------- PUBLIC: Create a Razorpay order for an existing order ----------

export const createPaymentOrder = async (req: Request, res: Response) => {
  try {
    const parsed = createPaymentOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'orderId required' });
    }

    const { orderId } = parsed.data;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ ok: false, error: 'Invalid order ID' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(409).json({ ok: false, error: 'Order already paid' });
    }

    const { razorpayOrderId, keyId } = await createRazorpayOrder(
      order.companyId.toString(),
      order.total,
      order.orderNumber
    );

    // Save the Razorpay order ID on our order record
    order.paymentGatewayRef = razorpayOrderId;
    await order.save();

    return res.status(200).json({
      ok: true,
      razorpayOrderId,
      keyId,
      amount: order.total,
      currency: 'INR',
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment initiation failed';
    console.error('Create payment order error:', message);
    return res.status(500).json({ ok: false, error: message });
  }
};

// ---------- PUBLIC: Verify payment signature after checkout ----------

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const parsed = verifyPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ ok: false, error: 'Invalid order ID' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    // Confirm the Razorpay order ID matches what we stored
    if (order.paymentGatewayRef !== razorpayOrderId) {
      return res.status(400).json({ ok: false, error: 'Razorpay order mismatch' });
    }

    // Verify the signature using the seller's secret
    const config = await SellerPaymentConfig.findOne({
      companyId: order.companyId,
      isActive: true,
    });
    if (!config) {
      return res.status(400).json({ ok: false, error: 'Seller payment config missing' });
    }

    // Decrypt secret in memory
    const secretWrapper = decrypt({
      ciphertext: config.razorpayKeySecretEncrypted,
      iv: config.encryptionIv,
      tag: config.encryptionTag,
    });

    let secret: string;
    try {
      secret = secretWrapper.reveal();
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not verify payment' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    secretWrapper.destroy();

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ ok: false, error: 'Invalid signature' });
    }

    // Signature is valid — mark the order paid
    order.paymentStatus = 'paid';
    order.razorpayPaymentId = razorpayPaymentId;
    await order.save();

    // Create a payment record
    await Payment.create({
      orderId: order._id,
      companyId: order.companyId,
      amount: order.total,
      currency: 'INR',
      gateway: 'razorpay',
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
      status: 'captured',
    });
           // Send order confirmation emails now that payment is confirmed
    try {
      const items = await OrderItem.find({ orderId: order._id });
      const company = await Company.findById(order.companyId);

      if (company) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const emailData = {
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
          trackUrl: `${frontendUrl}/track-order?order=${order.orderNumber}`,
          cancelUrl: `${frontendUrl}/track-order?order=${order.orderNumber}&action=cancel`,
        };
    
            Promise.all([
              sendOrderConfirmationToBuyer(emailData),
              sendNewOrderToSeller(emailData),
            ]).catch((err) => {
              console.error('[email] Post-payment notification failed:', err);
            });
          }
        } catch (err) {
          console.error('[email] Post-payment email setup failed:', err);
        }

    return res.status(200).json({ ok: true, message: 'Payment verified' });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};