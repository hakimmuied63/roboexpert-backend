import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ICompany extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerUserId: Types.ObjectId;
  contactEmail: string;
  contactPhone: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  logoUrl?: string;
  gstNumber: string;
  panCardUrl: string;
  isActive: boolean;

  // Storefront Customization
  bannerUrl?: string | null;
  tagline?: string | null;
  aboutText?: string | null;
  primaryColor?: string;
  layoutStyle?: 'grid' | 'list';
  gridColumns?: number;

  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },
    logoUrl: { type: String, trim: true },
    gstNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format'],
    },
    panCardUrl: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },

    // Storefront Customization
    bannerUrl: { type: String, default: null },
    tagline: { type: String, trim: true, maxlength: 120, default: null },
    aboutText: { type: String, trim: true, maxlength: 2000, default: null },
    primaryColor: { type: String, default: '#4f46e5' }, // Default indigo
    layoutStyle: { type: String, enum: ['grid', 'list'], default: 'grid' },
    gridColumns: { type: Number, enum: [2, 3, 4], default: 3 },
  },
  { timestamps: true }
);

companySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as any).__v;
    return ret;
  },
});

const Company: Model<ICompany> = mongoose.model<ICompany>('Company', companySchema);

export default Company;