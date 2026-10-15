import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  sendOtpController,
  verifyOtpController,
} from '../controllers/otp.controller.js';

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,          // 1 minute
  max: 3,                        // max 3 sends per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many OTP requests. Try again in a minute.' },
});

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many verification attempts.' },
});

const router = Router();

router.post('/send', sendLimiter, sendOtpController);
router.post('/verify', verifyLimiter, verifyOtpController);

export default router;