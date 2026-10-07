import { Request, Response } from 'express';
import { z } from 'zod';
import { chatWithBot } from '../services/chat.service.js';

const chatSchema = z.object({
  message: z.string().min(1).max(1000).trim(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        parts: z.string().max(2000),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

export const chatHandler = async (req: Request, res: Response) => {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { message, history } = parsed.data;

    const result = await chatWithBot(message, history);

    return res.status(200).json({
      ok: true,
      reply: result.reply,
      products: result.products,
    });
  } catch (error) {
    console.error('Chat handler error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
};