import { Router } from 'express';
import { createLead } from '../controllers/lead.controller.js';
import { leadsLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// Public — capture lead from popup, rate limited
router.post('/', leadsLimiter, createLead);

export default router;