import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type PaymentMethod = 'cod' | 'online';

export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'completed';

export interface IOrder extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  orderNumber: string;
  buyer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  subtotal: number;
  shippingFee: number;
  packagingFee: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentGatewayRef?: string;
  razorpayPaymentId?: string;
  notes?: string;

  // Cancellation
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  cancellationNote?: string | null;

  // Returns
  returnStatus?: ReturnStatus | null;
  returnReason?: string | null;
  returnNote?: string | null;
  returnRequestedAt?: Date | null;
  returnResolvedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    buyer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
    },
    shippingAddress: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
      country: { type: String, default: 'India', trim: true },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    packagingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'placed',
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'online'],
      default: 'online',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentGatewayRef: {
      type: String,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: null,
    },
    cancellationNote: {
      type: String,
      trim: true,
      default: null,
    },
    returnStatus: {
      type: String,
      enum: ['requested', 'approved', 'rejected', 'completed', null],
      default: null,
    },
    returnReason: {
      type: String,
      trim: true,
      default: null,
    },
    returnNote: {
      type: String,
      trim: true,
      default: null,
    },
    returnRequestedAt: {
      type: Date,
      default: null,
    },
    returnResolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as any).__v;
    return ret;
  },
});

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', orderSchema);

export default Order;