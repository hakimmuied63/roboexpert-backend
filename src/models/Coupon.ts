import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ICoupon extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  code: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  expiresAt?: Date | null;
  isActive: boolean;
  isPublic: boolean;
  
  // If empty, applies to whole store. If populated, applies only to these products.
  applicableProducts: Types.ObjectId[]; 
  
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 1,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    applicableProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
  },
  { timestamps: true }
);

couponSchema.index({ companyId: 1, code: 1 }, { unique: true });

const Coupon: Model<ICoupon> = mongoose.model<ICoupon>('Coupon', couponSchema);

export default Coupon;