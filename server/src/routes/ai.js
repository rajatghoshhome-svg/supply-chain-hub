import { Router } from 'express';
import { streamChat } from '../services/claude.js';

export const aiRouter = Router();

aiRouter.post('/chat', async (req, res, next) => {
  try {
    const { module = 'general', messages = [] } = req.body;
    await streamChat({ module, messages, res });
  } catch (err) {
    // If headers already sent (mid-stream), just end
    if (res.headersSent) {
      res.end();
    } else {
      next(err);
    }
  }
});
