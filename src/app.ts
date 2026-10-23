import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import companyRoutes from './routes/company.routes.js';
import productRoutes from './routes/product.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import orderRoutes from './routes/order.routes.js';
import adminRoutes from './routes/admin.routes.js';
import paymentConfigRoutes from './routes/paymentConfig.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import categoryRoutes from './routes/category.routes.js';
import chatRoutes from './routes/chat.routes.js';
import leadRoutes from './routes/lead.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import reviewRoutes from './routes/review.routes.js';
import otpRoutes from './routes/otp.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import adminReviewRoutes from './routes/adminReview.routes.js';

const app: Application = express();

// Middleware
// CORS — allow configured frontend + localhost for dev
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use('/webhooks', webhookRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'roboexpert-backend',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/companies', companyRoutes);
app.use('/', reviewRoutes);
app.use('/products', productRoutes);
app.use('/categories', categoryRoutes);
app.use('/chat', chatRoutes);
app.use('/leads', leadRoutes);
app.use('/upload', uploadRoutes);
app.use('/catalog', catalogRoutes);
app.use('/orders', orderRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/reviews', adminReviewRoutes);
app.use('/payment-config', paymentConfigRoutes);
app.use('/payments', paymentRoutes);
app.use('/otp', otpRoutes);

// 404 handler — must come after all routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: 'Route not found' });
});

export default app;