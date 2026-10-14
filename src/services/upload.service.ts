import { v2 as cloudinary } from 'cloudinary';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.warn(
    '[upload] Cloudinary credentials not set — image uploads will fail'
  );
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
  secure: true,
});

export type UploadResult = {
  ok: boolean;
  url?: string;
  publicId?: string;
  error?: string;
};

/**
 * Upload a file buffer to Cloudinary.
 * @param fileBuffer - the file's raw buffer
 * @param folder - Cloudinary folder (e.g., "products", "sellers")
 * @param mimeType - the file's mime type (for validation)
 */
export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder: string,
  mimeType: string
): Promise<UploadResult> => {
  try {
    // Validate mime type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(mimeType)) {
      return { ok: false, error: 'Only JPEG, PNG, WebP, and GIF are allowed' };
    }

    // Upload as base64 data URI
    const base64 = fileBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `roboexpert/${folder}`,
      resource_type: 'image',
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' }, // cap size
        { quality: 'auto:good' }, // auto-compress
        { fetch_format: 'auto' }, // auto WebP/AVIF
      ],
    });

    return {
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Upload failed';
    console.error('[upload] Cloudinary error:', msg);
    return { ok: false, error: msg };
  }
};

/**
 * Delete an image from Cloudinary by public ID.
 */
export const deleteFromCloudinary = async (publicId: string): Promise<boolean> => {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.error('[upload] Delete error:', error);
    return false;
  }
};