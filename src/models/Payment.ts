import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type PaymentStatus = 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  companyId: Types.ObjectId;
  amount: number;
  currency: string;
  gateway: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  status: PaymentStatus;
  method?: string;
  rawResponse?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    gateway: {
      type: String,
      default: 'razorpay',
      trim: true,
    },
    gatewayOrderId: {
      type: String,
      required: true,
      trim: true,
    },
    gatewayPaymentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
      default: 'captured',
    },
    method: {
      type: String,
      trim: true,
    },
    rawResponse: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as any).__v;
    return ret;
  },
});

const Payment: Model<IPayment> = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;