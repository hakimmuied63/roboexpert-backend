import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IProduct extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  categoryId?: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  basePrice: number;
  images: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    images: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Two companies can have the same product slug; one company cannot have duplicates
productSchema.index({ companyId: 1, slug: 1 }, { unique: true });

// For product search across the marketplace
productSchema.index({ name: 'text', description: 'text' });

productSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as any).__v;
    return ret;
  },
});

const Product: Model<IProduct> = mongoose.model<IProduct>('Product', productSchema);

export default Product;