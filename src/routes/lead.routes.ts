import { Router } from 'express';
import { createLead } from '../controllers/lead.controller.js';

const router = Router();

// Public — capture lead from popup
router.post('/', createLead);

export default router;