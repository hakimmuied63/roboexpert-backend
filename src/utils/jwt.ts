import jwt from 'jsonwebtoken';
import crypto from 'crypto';

type TokenPayload = {
  userId: string;
  role: 'admin' | 'seller';
  companyId?: string;
};

// ---------- Access token ----------

export const signAccessToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');

  return jwt.sign(payload, secret, {
    expiresIn: '15m',
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');

  return jwt.verify(token, secret) as TokenPayload;
};

// ---------- Refresh token ----------

// Refresh tokens are random strings (not JWTs).
// We store only their hash in the DB — never the raw token.

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(48).toString('hex');
};

export const hashRefreshToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};