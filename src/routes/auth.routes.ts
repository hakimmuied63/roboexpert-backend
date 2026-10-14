import { Router } from 'express';
import {
  signup,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';
import { authLimiter, signupLimiter } from '../middleware/rateLimiters.js';

const router = Router();

router.post('/signup', signupLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

export default router;