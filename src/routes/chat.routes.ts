import { Router } from 'express';
import { chatHandler } from '../controllers/chat.controller.js';

const router = Router();

// Public — chatbot (no auth required)
router.post('/', chatHandler);

export default router;