import { Router } from 'express';
import { chatHandler } from '../controllers/chat.controller.js';
import { chatLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// Public — chatbot (no auth required), rate limited
router.post('/', chatLimiter, chatHandler);

export default router;