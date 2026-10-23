import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import OrderItem from '../models/OrderItem.js';
import Company from '../models/Company.js';
import {
  sendOrderConfirmationToBuyer,
  sendNewOrderToSeller,
} from '../services/email.service.js';

const router = Router();

// Raw body parser — MUST be used here (not express.json)
router.post(
  '/razorpay',
  (req, res, next) => {
    // We need the raw body as a Buffer to verify the signature
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      (req as any).rawBody = data;
      try {
        (req as any).body = JSON.parse(data);
      } catch {
        (req as any).body = {};
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!secret) {
        console.error('[webhook] RAZORPAY_WEBHOOK_SECRET not set');
        return res.status(500).send('Webhook secret not configured');
      }

      const signature = req.headers['x-razorpay-signature'] as string;
      const rawBody = (req as any).rawBody as string;

      if (!signature || !rawBody) {
        return res.status(400).send('Missing signature or body');
      }

      // Verify HMAC-SHA256 signature
      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      if (expected !== signature) {
        console.error('[webhook] Signature mismatch');
        return res.status(400).send('Invalid signature');
      }

      const event = (req as any).body;
      const eventType = event?.event;
      const paymentEntity = event?.payload?.payment?.entity;

      console.log('[webhook] Received:', eventType, '| payment:', paymentEntity?.id);

      // ---------- Handle payment.captured ----------
      if (eventType === 'payment.captured' && paymentEntity) {
        const razorpayOrderId = paymentEntity.order_id;
        const razorpayPaymentId = paymentEntity.id;

        if (!razorpayOrderId) {
          console.error('[webhook] No order_id in payment.captured');
          return res.status(200).send('OK');
        }

        // Find our order by the Razorpay order ID we stored earlier
        const order = await Order.findOne({ paymentGatewayRef: razorpayOrderId });

        if (!order) {
          console.error('[webhook] Order not found for razorpay order:', razorpayOrderId);
          return res.status(200).send('OK'); // Acknowledge — nothing to update
        }

        // Idempotency: skip if already paid
        if (order.paymentStatus === 'paid') {
          console.log('[webhook] Order already paid:', order.orderNumber);
          return res.status(200).send('OK');
        }

        // Mark paid
        order.paymentStatus = 'paid';
        order.razorpayPaymentId = razorpayPaymentId;
        await order.save();

        // Create payment record if not exists
        const existingPayment = await Payment.findOne({
          gatewayPaymentId: razorpayPaymentId,
        });
        if (!existingPayment) {
          await Payment.create({
            orderId: order._id,
            companyId: order.companyId,
            amount: paymentEntity.amount / 100,
            currency: 'INR',
            gateway: 'razorpay',
            gatewayOrderId: razorpayOrderId,
            gatewayPaymentId: razorpayPaymentId,
            status: 'captured',
          });
        }

        // Send emails (fire and forget)
        (async () => {
          try {
            const items = await OrderItem.find({ orderId: order._id });
            const company = await Company.findById(order.companyId);
            if (!company) return;

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const emailData = {
              orderNumber: order.orderNumber,
              buyerName: order.buyer.name,
              buyerEmail: order.buyer.email,
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
              cancelUrl: `${frontendUrl}/track-order?order=${order.orderNumber}&email=${encodeURIComponent(order.buyer.email)}&action=cancel`,
            };

            await Promise.all([
              sendOrderConfirmationToBuyer(emailData),
              sendNewOrderToSeller(emailData),
            ]);
            console.log('[webhook] Emails sent for', order.orderNumber);
          } catch (err) {
            console.error('[webhook] Email send failed:', err);
          }
        })();

        console.log('[webhook] Order marked paid via webhook:', order.orderNumber);
      }

      // ---------- Handle payment.failed ----------
      if (eventType === 'payment.failed' && paymentEntity) {
        const razorpayOrderId = paymentEntity.order_id;
        const order = await Order.findOne({ paymentGatewayRef: razorpayOrderId });
        if (order && order.paymentStatus === 'pending') {
          order.paymentStatus = 'failed';
          await order.save();
          console.log('[webhook] Order marked failed:', order.orderNumber);
        }
      }

      // Always acknowledge
      return res.status(200).send('OK');
    } catch (error) {
      console.error('[webhook] Handler error:', error);
      return res.status(500).send('Internal error');
    }
  }
);

export default router;