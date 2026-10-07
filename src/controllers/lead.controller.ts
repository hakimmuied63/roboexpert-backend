import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Lead from '../models/Lead.js';

// ---------- Validation ----------

const createLeadSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  phone: z
    .string()
    .min(10)
    .max(20)
    .trim()
    .refine((v) => /^[0-9+\-\s()]+$/.test(v), 'Invalid phone number'),
  source: z.string().max(50).trim().optional(),
});

// ---------- PUBLIC: Create a lead ----------

export const createLead = async (req: Request, res: Response) => {
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, phone, source } = parsed.data;

    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined;

    const lead = await Lead.create({
      name,
      phone,
      source: source ?? 'popup',
      userAgent,
    });

    return res.status(201).json({ ok: true, lead });
  } catch (error) {
    console.error('Create lead error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- ADMIN: List leads ----------

export const adminListLeads = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;

    const filter: Record<string, unknown> = {};
    if (typeof search === 'string' && search.trim()) {
      const regex = { $regex: search.trim(), $options: 'i' };
      filter.$or = [{ name: regex }, { phone: regex }];
    }

    const leads = await Lead.find(filter).sort({ createdAt: -1 }).limit(500);

    return res.status(200).json({ ok: true, leads });
  } catch (error) {
    console.error('Admin list leads error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- ADMIN: Delete lead ----------

export const adminDeleteLead = async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({ ok: false, error: 'Invalid lead ID' });
    }

    const lead = await Lead.findByIdAndDelete(leadId);
    if (!lead) {
      return res.status(404).json({ ok: false, error: 'Lead not found' });
    }

    return res.status(200).json({ ok: true, message: 'Lead deleted' });
  } catch (error) {
    console.error('Admin delete lead error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};