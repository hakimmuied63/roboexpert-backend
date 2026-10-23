import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IReview extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  companyId: Types.ObjectId;
  buyerId: Types.ObjectId;
  buyerName: string;
  orderId: Types.ObjectId;
  rating: number;
  comment?: string | null;
  images: string[];

  // Moderation / reporting
  reported: boolean;
  reportedAt?: Date | null;
  reportedBy?: Types.ObjectId | null;
  reportedByRole?: 'buyer' | 'seller' | 'admin' | null;
  reportReason?: string | null;
  hidden: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    buyerName: {
      type: String,
      required: true,
      trim: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length <= 3,
        message: 'Maximum 3 images per review',
      },
    },
    reported: {
      type: Boolean,
      default: false,
    },
    reportedAt: {
      type: Date,
      default: null,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reportedByRole: {
        type: String,
        enum: ['buyer', 'seller', 'admin', null],
        default: null,
      },
    reportReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    hidden: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// One review per buyer per product
reviewSchema.index({ productId: 1, orderId: 1 }, { unique: true });

// Fast lookup for product reviews list (newest first)
reviewSchema.index({ productId: 1, hidden: 1, createdAt: -1 });

reviewSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as any).__v;
    return ret;
  },
});

const Review: Model<IReview> = mongoose.model<IReview>('Review', reviewSchema);

export default Review;