import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';

/**
 * Recalculate a product's rating average and count from its visible reviews.
 * Call this after creating, deleting, hiding, or unhiding a review for that product.
 */
export const recalculateProductRating = async (
  productId: string | mongoose.Types.ObjectId
): Promise<{ ratingAverage: number; ratingCount: number }> => {
  const productObjectId =
    typeof productId === 'string' ? new mongoose.Types.ObjectId(productId) : productId;

  const result = await Review.aggregate([
    {
      $match: {
        productId: productObjectId,
        hidden: false,
      },
    },
    {
      $group: {
        _id: '$productId',
        avg: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const ratingAverage = result[0]?.avg ?? 0;
  const ratingCount = result[0]?.count ?? 0;

  await Product.updateOne(
    { _id: productObjectId },
    {
      $set: {
        ratingAverage: Math.round(ratingAverage * 10) / 10, // 1 decimal place
        ratingCount,
      },
    }
  );

  return { ratingAverage, ratingCount };
};

/**
 * Recalculate a specific SKU's (Variant's) rating average and count.
 * Call this after creating, deleting, hiding, or unhiding a review for that variant.
 */
export const recalculateVariantRating = async (
  variantId: string | mongoose.Types.ObjectId
): Promise<{ ratingAverage: number; ratingCount: number }> => {
  const variantObjectId =
    typeof variantId === 'string' ? new mongoose.Types.ObjectId(variantId) : variantId;

  const result = await Review.aggregate([
    {
      $match: {
        variantId: variantObjectId,
        hidden: false,
      },
    },
    {
      $group: {
        _id: '$variantId',
        avg: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const ratingAverage = result[0]?.avg ?? 0;
  const ratingCount = result[0]?.count ?? 0;

  await ProductVariant.updateOne(
    { _id: variantObjectId },
    {
      $set: {
        ratingAverage: Math.round(ratingAverage * 10) / 10,
        ratingCount,
      },
    }
  );

  return { ratingAverage, ratingCount };
};