import crypto from 'crypto';
import Otp, { type OtpPurpose } from '../models/Otp.js';
import { sendOtpEmail } from './email.service.js';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;

// ---------- Generate 6-digit code ----------

const generateCode = (): string => {
  return crypto
    .randomInt(0, Math.pow(10, OTP_LENGTH))
    .toString()
    .padStart(OTP_LENGTH, '0');
};

// ---------- Send OTP ----------

export type SendOtpResult =
  | { ok: true }
  | { ok: false; error: string };

export const sendOtp = async (
  email: string,
  purpose: OtpPurpose = 'checkout'
): Promise<SendOtpResult> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Delete any existing unverified OTPs for this email + purpose
    await Otp.deleteMany({
      email: normalizedEmail,
      purpose,
      verified: false,
    });

    // Create new OTP
    await Otp.create({
      email: normalizedEmail,
      code,
      purpose,
      expiresAt,
    });

    // Send email
    const result = await sendOtpEmail(normalizedEmail, code, purpose);

    if (!result.ok) {
      return { ok: false, error: result.error ?? 'Failed to send OTP email' };
    }

    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'OTP send failed';
    console.error('[otp] Send error:', msg);
    return { ok: false, error: msg };
  }
};

// ---------- Verify OTP ----------

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: string };

export const verifyOtp = async (
  email: string,
  code: string,
  purpose: OtpPurpose = 'checkout'
): Promise<VerifyOtpResult> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    const otp = await Otp.findOne({
      email: normalizedEmail,
      purpose,
      verified: false,
    }).sort({ createdAt: -1 });

    if (!otp) {
      return { ok: false, error: 'No OTP found. Please request a new one.' };
    }

    if (otp.expiresAt < new Date()) {
      await otp.deleteOne();
      return { ok: false, error: 'OTP has expired. Please request a new one.' };
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      await otp.deleteOne();
      return {
        ok: false,
        error: 'Too many failed attempts. Please request a new OTP.',
      };
    }

    if (otp.code !== trimmedCode) {
      otp.attempts += 1;
      await otp.save();
      return {
        ok: false,
        error: `Invalid OTP. ${MAX_ATTEMPTS - otp.attempts} attempts remaining.`,
      };
    }

    // Success
    otp.verified = true;
    await otp.save();

    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'OTP verify failed';
    console.error('[otp] Verify error:', msg);
    return { ok: false, error: msg };
  }
};