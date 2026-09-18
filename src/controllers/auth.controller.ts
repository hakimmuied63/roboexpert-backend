import { Request, Response } from 'express';
import { z } from 'zod';
import User from '../models/User.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '../utils/jwt.js';
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
    });

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const refreshToken = generateRefreshToken();
    user.refreshTokenHash = hashRefreshToken(refreshToken);
    await user.save();

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