import { Request, Response } from 'express';
import { uploadToCloudinary } from '../services/upload.service.js';

// Folders allowed for different upload types
const ALLOWED_FOLDERS = ['products', 'sellers', 'profiles', 'leads'] as const;
type UploadFolder = (typeof ALLOWED_FOLDERS)[number];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    if (req.file.size > MAX_FILE_SIZE) {
      return res
        .status(400)
        .json({ ok: false, error: 'File too large (max 5 MB)' });
    }

    // Read folder from body or query; default to "products"
    const rawFolder =
      (req.body?.folder as string) || (req.query?.folder as string) || 'products';

    if (!ALLOWED_FOLDERS.includes(rawFolder as UploadFolder)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(', ')}`,
      });
    }

    const folder = rawFolder as UploadFolder;

    const result = await uploadToCloudinary(
      req.file.buffer,
      folder,
      req.file.mimetype
    );

    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.error });
    }

    return res.status(200).json({
      ok: true,
      url: result.url,
      publicId: result.publicId,
    });
  } catch (error) {
    console.error('Upload controller error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};