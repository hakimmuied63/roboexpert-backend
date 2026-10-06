import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type UserRole = 'admin' | 'seller';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  companyId?: Types.ObjectId;
  name: string;
  phone?: string;
  isActive: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  approvalNote?: string | null;
  approvedAt?: Date | null;
  approvedBy?: Types.ObjectId | null;
  refreshTokenHash?: string | null;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'seller'],
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'approved',
    },
    approvalNote: {
      type: String,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    refreshTokenHash: {
      type: String,
      default: null,
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as any).passwordHash;
    delete (ret as any).refreshTokenHash;
    delete (ret as any).passwordResetToken;
    delete (ret as any).passwordResetExpires;
    delete (ret as any).__v;
    return ret;
  },
});
const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;