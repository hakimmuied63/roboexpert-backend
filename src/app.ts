import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';

const app: Application = express();

// Middleware
app.use(cors());
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

// 404 handler — must come after all routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: 'Route not found' });
});

export default app;