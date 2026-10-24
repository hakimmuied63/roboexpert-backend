import { Router } from 'express';
import multer from 'multer';
import { uploadImage } from '../controllers/upload.controller.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// Multer config — store in memory (we pass buffer to Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

// Public — needed for signup flow (uploading PAN card before user exists)
// Rate-limited to prevent abuse
router.post('/', uploadLimiter, upload.single('file'), uploadImage);

export default router;