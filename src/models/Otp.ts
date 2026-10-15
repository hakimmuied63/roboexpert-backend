import mongoose, { Schema, Document, Model } from 'mongoose';

export type OtpPurpose = 'checkout' | 'signup' | 'password_reset';

export interface IOtp extends Document {
  email: string;
  code: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['checkout', 'signup', 'password_reset'],
      default: 'checkout',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index - auto-delete after expiry
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: 'otps',
    timestamps: true,
  }
);

otpSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as any).__v;
    return ret;
  },
});

const Otp: Model<IOtp> = mongoose.model<IOtp>('Otp', otpSchema);

export default Otp;