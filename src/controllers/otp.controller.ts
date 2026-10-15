import type { Request, Response } from 'express';
import { sendOtp, verifyOtp } from '../services/otp.service.js';
import type { OtpPurpose } from '../models/Otp.js';

const VALID_PURPOSES: OtpPurpose[] = ['checkout', 'signup', 'password_reset'];

const normalisePurpose = (raw: unknown): OtpPurpose =>
  VALID_PURPOSES.includes(raw as OtpPurpose) ? (raw as OtpPurpose) : 'checkout';

const isValidEmail = (email: unknown): email is string =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// POST /otp/send
export const sendOtpController = async (req: Request, res: Response) => {
  const { email, purpose } = req.body ?? {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Valid email required' });
  }

  const result = await sendOtp(email, normalisePurpose(purpose));

  if (!result.ok) {
    return res.status(500).json({ ok: false, error: result.error });
  }

  return res.json({ ok: true, message: 'OTP sent' });
};

// POST /otp/verify
export const verifyOtpController = async (req: Request, res: Response) => {
  const { email, code, purpose } = req.body ?? {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Valid email required' });
  }
  if (typeof code !== 'string' || code.trim().length !== 6) {
    return res.status(400).json({ ok: false, error: '6-digit OTP required' });
  }

  const result = await verifyOtp(email, code, normalisePurpose(purpose));

  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }

  return res.json({ ok: true, message: 'OTP verified' });
};