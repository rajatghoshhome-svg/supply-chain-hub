import { Router } from 'express';
import { db } from '../db/connection.js';
import { skus } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const skusRouter = Router();

skusRouter.get('/', async (req, res, next) => {
  try {
    const rows = await db.select().from(skus);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

skusRouter.get('/:id', async (req, res, next) => {
  try {
    const [row] = await db.select().from(skus).where(eq(skus.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: 'SKU not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

skusRouter.post('/', async (req, res, next) => {
  try {
    const [row] = await db.insert(skus).values(req.body).returning();
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});
