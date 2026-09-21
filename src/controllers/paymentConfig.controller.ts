import { Request, Response } from 'express';
import { z } from 'zod';
import SellerPaymentConfig from '../models/SellerPaymentConfig.js';
import { encrypt } from '../utils/encryption.js';

// ---------- Validation ----------

const saveConfigSchema = z.object({
  razorpayKeyId: z.string().min(1).trim(),
  razorpayKeySecret: z.string().min(1).trim(),
});

// ---------- Save / update my payment config (seller) ----------

export const savePaymentConfig = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }
    if (!req.user.companyId) {
      return res.status(400).json({ ok: false, error: 'Create a company first' });
    }

    const parsed = saveConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { razorpayKeyId, razorpayKeySecret } = parsed.data;

    const encrypted = encrypt(razorpayKeySecret);

    const config = await SellerPaymentConfig.findOneAndUpdate(
      { companyId: req.user.companyId },
      {
        $set: {
          razorpayKeyId,
          razorpayKeySecretEncrypted: encrypted.ciphertext,
          encryptionIv: encrypted.iv,
          encryptionTag: encrypted.tag,
          isActive: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ ok: true, config });
  } catch (error) {
    console.error('Save payment config error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Get my payment config status (seller) ----------

export const getMyPaymentConfig = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }
    if (!req.user.companyId) {
      return res.status(400).json({ ok: false, error: 'No company found' });
    }

    const config = await SellerPaymentConfig.findOne({ companyId: req.user.companyId });

    if (!config) {
      return res.status(200).json({
        ok: true,
        configured: false,
        config: null,
      });
    }

    return res.status(200).json({
      ok: true,
      configured: true,
      config,
    });
  } catch (error) {
    console.error('Get payment config error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Delete my payment config (seller) ----------

export const deletePaymentConfig = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ ok: false, error: 'Seller access required' });
    }
    if (!req.user.companyId) {
      return res.status(400).json({ ok: false, error: 'No company found' });
    }

    const deleted = await SellerPaymentConfig.findOneAndDelete({
      companyId: req.user.companyId,
    });

    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'No payment config found' });
    }

    return res.status(200).json({ ok: true, message: 'Payment config removed' });
  } catch (error) {
    console.error('Delete payment config error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Admin: list all payment configs status ----------

export const adminListPaymentConfigs = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const configs = await SellerPaymentConfig.find().select(
      'companyId razorpayKeyId isActive createdAt updatedAt'
    );

    return res.status(200).json({ ok: true, configs });
  } catch (error) {
    console.error('Admin list payment configs error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};