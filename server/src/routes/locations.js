import { Router } from 'express';
import { db } from '../db/connection.js';
import { locations } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const locationsRouter = Router();

locationsRouter.get('/', async (req, res, next) => {
  try {
    const rows = await db.select().from(locations);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

locationsRouter.get('/:id', async (req, res, next) => {
  try {
    const [row] = await db.select().from(locations).where(eq(locations.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: 'Location not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
});
