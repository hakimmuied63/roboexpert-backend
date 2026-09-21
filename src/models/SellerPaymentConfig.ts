import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ISellerPaymentConfig extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  razorpayKeyId: string;
  razorpayKeySecretEncrypted: string;
  encryptionIv: string;
  encryptionTag: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const sellerPaymentConfigSchema = new Schema<ISellerPaymentConfig>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true,
      index: true,
    },
    razorpayKeyId: {
      type: String,
      required: true,
      trim: true,
    },
    razorpayKeySecretEncrypted: {
      type: String,
      required: true,
    },
    encryptionIv: {
      type: String,
      required: true,
    },
    encryptionTag: {
      type: String,
      required: true,
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

// Never expose secrets in API responses
sellerPaymentConfigSchema.set('toJSON', {
    transform: (_doc, ret) => {
      delete (ret as any).__v;
      delete (ret as any).razorpayKeySecretEncrypted;
      delete (ret as any).encryptionIv;
      delete (ret as any).encryptionTag;
      return ret;
    },
  });
  
  // Belt-and-braces: also strip secrets when the document is serialized to plain object
  sellerPaymentConfigSchema.set('toObject', {
    transform: (_doc, ret) => {
      delete (ret as any).__v;
      delete (ret as any).razorpayKeySecretEncrypted;
      delete (ret as any).encryptionIv;
      delete (ret as any).encryptionTag;
      return ret;
    },
  });

const SellerPaymentConfig: Model<ISellerPaymentConfig> = mongoose.model<ISellerPaymentConfig>(
  'SellerPaymentConfig',
  sellerPaymentConfigSchema
);

export default SellerPaymentConfig;