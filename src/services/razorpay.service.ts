import Razorpay from 'razorpay';
import SellerPaymentConfig from '../models/SellerPaymentConfig.js';
import { decrypt } from '../utils/encryption.js';

/**
 * Loads the seller's Razorpay client for a given company.
 * Decrypts the secret in memory, uses it once, then destroys it.
 * Never returns the secret or the client to the caller in a way that could leak.
 */
export const getRazorpayClientForCompany = async (
  companyId: string
): Promise<{ client: Razorpay; keyId: string }> => {
  const config = await SellerPaymentConfig.findOne({ companyId, isActive: true });
  if (!config) {
    throw new Error('Seller has not configured Razorpay');
  }

  const secretWrapper = decrypt({
    ciphertext: config.razorpayKeySecretEncrypted,
    iv: config.encryptionIv,
    tag: config.encryptionTag,
  });

  let secret: string;
  try {
    secret = secretWrapper.reveal();
  } catch {
    throw new Error('Could not decrypt seller secret');
  }

  const client = new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: secret,
  });

  // Zero out the plaintext immediately after passing it to Razorpay
  secretWrapper.destroy();

  return { client, keyId: config.razorpayKeyId };
};

/**
 * Create a Razorpay order for a given amount (in rupees).
 * Razorpay expects the amount in paise (1 rupee = 100 paise).
 */
export const createRazorpayOrder = async (
  companyId: string,
  amountInRupees: number,
  receiptId: string
): Promise<{ razorpayOrderId: string; keyId: string }> => {
  const { client, keyId } = await getRazorpayClientForCompany(companyId);

  const order = await client.orders.create({
    amount: Math.round(amountInRupees * 100), // paise
    currency: 'INR',
    receipt: receiptId,
  });

  return { razorpayOrderId: order.id, keyId };
};

/**
 * Refund a Razorpay payment (full or partial).
 * Uses the seller's Razorpay account — because the payment was captured
 * on the seller's account during checkout.
 *
 * @param companyId          Seller's company ID (to load their Razorpay config)
 * @param razorpayPaymentId  The Razorpay payment ID (pay_xxx) stored on our Order
 * @param amountInRupees     Amount to refund, in rupees
 */
export const refundRazorpayPayment = async (
  companyId: string,
  razorpayPaymentId: string,
  amountInRupees: number
): Promise<{ refundId: string; status: string; amount: number }> => {
  if (!razorpayPaymentId || !razorpayPaymentId.startsWith('pay_')) {
    throw new Error('Invalid Razorpay payment ID');
  }

  if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
    throw new Error('Refund amount must be greater than zero');
  }

  const { client } = await getRazorpayClientForCompany(companyId);

  const refund = await client.payments.refund(razorpayPaymentId, {
    amount: Math.round(amountInRupees * 100), // paise
    speed: 'normal',
  });

  return {
    refundId: refund.id,
    status: (refund as any).status ?? 'processed',
    amount: amountInRupees,
  };
};