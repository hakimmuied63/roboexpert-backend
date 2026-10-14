import { Router } from 'express';
import multer from 'multer';
import { uploadImage } from '../controllers/upload.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// Multer config — store in memory (we pass buffer to Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

// Auth required + rate limited
router.post('/', requireAuth, uploadLimiter, upload.single('file'), uploadImage);

export default router;