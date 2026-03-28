import { Router } from 'express';
import { db } from '../db/connection.js';
import { customers } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const customersRouter = Router();

customersRouter.get('/', async (req, res, next) => {
  try {
    const rows = await db.select().from(customers);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

customersRouter.get('/:id', async (req, res, next) => {
  try {
    const [row] = await db.select().from(customers).where(eq(customers.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: 'Customer not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
});
