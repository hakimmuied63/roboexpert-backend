import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import User from '../models/User.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '../utils/jwt.js';
import { sendNewSellerAlertToAdmin } from '../services/email.service.js';
// ---------- Validation schema ----------

const signupSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).trim(),
  role: z.enum(['admin', 'seller']),
  phone: z.string().trim().optional(),
});

// ---------- Signup ----------

export const signup = async (req: Request, res: Response) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password, name, role, phone } = parsed.data;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      email,
      passwordHash,
      name,
      role,
      phone,
      // Sellers start as pending — admins auto-approve themselves
      approvalStatus: role === 'seller' ? 'pending' : 'approved',
    });

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const refreshToken = generateRefreshToken();
    user.refreshTokenHash = hashRefreshToken(refreshToken);
    await user.save();

    // Fire-and-forget: notify admin when a new seller signs up
    if (role === 'seller') {
      sendNewSellerAlertToAdmin({
        name,
        email,
        phone,
      }).catch((err) => {
        console.error('[email] Admin new-seller alert failed:', err);
      });
    }

    return res.status(201).json({
      ok: true,
      user,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
// ---------- Validation schema ----------

const loginSchema = z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(1, 'Password is required'),
  });
  
  // ---------- Login ----------
  
  export const login = async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }
  
      const { email, password } = parsed.data;
  
      const user = await User.findOne({ email });
      if (!user || !user.isActive) {
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
      }
  
      const passwordOk = await verifyPassword(password, user.passwordHash);
      if (!passwordOk) {
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
      }
  
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        role: user.role,
        companyId: user.companyId?.toString(),
      });
  
      const refreshToken = generateRefreshToken();
      user.refreshTokenHash = hashRefreshToken(refreshToken);
      await user.save();
  
      return res.status(200).json({
        ok: true,
        user,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
  // ---------- Validation schema ----------

const refreshSchema = z.object({
    refreshToken: z.string().min(1),
  });
  
  // ---------- Refresh access token ----------
  
  export const refresh = async (req: Request, res: Response) => {
    try {
      const parsed = refreshSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: 'refreshToken required' });
      }
  
      const { refreshToken } = parsed.data;
      const tokenHash = hashRefreshToken(refreshToken);
  
      const user = await User.findOne({ refreshTokenHash: tokenHash });
      if (!user || !user.isActive) {
        return res.status(401).json({ ok: false, error: 'Invalid refresh token' });
      }
  
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        role: user.role,
        companyId: user.companyId?.toString(),
      });
  
      // Rotate refresh token (optional but recommended)
      const newRefreshToken = generateRefreshToken();
      user.refreshTokenHash = hashRefreshToken(newRefreshToken);
      await user.save();
  
      return res.status(200).json({
        ok: true,
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error('Refresh error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
  
  // ---------- Logout ----------
  
  export const logout = async (req: Request, res: Response) => {
    try {
      const parsed = refreshSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: 'refreshToken required' });
      }
  
      const { refreshToken } = parsed.data;
      const tokenHash = hashRefreshToken(refreshToken);
  
      // Find user by refresh token hash and clear it
      await User.findOneAndUpdate(
        { refreshTokenHash: tokenHash },
        { $set: { refreshTokenHash: null } }
      );
  
      return res.status(200).json({ ok: true, message: 'Logged out' });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
  // ---------- Forgot Password ----------

const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Valid email required' });
    }

    const { email } = parsed.data;

    const user = await User.findOne({ email });

    // Always return success, even if user not found (security — don't leak which emails exist)
    if (!user) {
      return res.status(200).json({
        ok: true,
        message: 'If that email exists, a reset link has been sent.',
      });
    }

    // Generate a random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Save hashed token + expiry (1 hour) on user
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    // TODO: send email with rawToken to user.email
    // For now, return the token in the response (dev only)
    return res.status(200).json({
      ok: true,
      message: 'If that email exists, a reset link has been sent.',
      devToken: rawToken, // dev only — remove before production
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

// ---------- Reset Password ----------

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { token, newPassword } = parsed.data;

    // Hash incoming token and look up user
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ ok: false, error: 'Invalid or expired token' });
    }

    // Update password
    user.passwordHash = await hashPassword(newPassword);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    // Invalidate all refresh tokens (force re-login on all devices)
    user.refreshTokenHash = null;
    await user.save();

    return res.status(200).json({
      ok: true,
      message: 'Password reset successfully. Please log in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};