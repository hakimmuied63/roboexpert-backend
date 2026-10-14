import rateLimit from 'express-rate-limit';

// General limiter — applies to most endpoints
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Too many requests. Please try again later.',
  },
});

// Auth limiter — strict for login/signup (brute force protection)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Too many auth attempts. Please try again in 15 minutes.',
  },
  skipSuccessfulRequests: true, // only count failed attempts
});

// Signup limiter — prevent spam accounts
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Too many signup attempts. Please try again later.',
  },
});

// Leads limiter — prevent lead form spam
export const leadsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Too many submissions. Please try again later.',
  },
});

// Chat limiter — prevent AI abuse
export const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Chat limit reached. Please try again later.',
  },
});

// Upload limiter — prevent storage abuse
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Upload limit reached. Please try again later.',
  },
});