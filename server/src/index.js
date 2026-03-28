import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { locationsRouter } from './routes/locations.js';
import { skusRouter } from './routes/skus.js';
import { customersRouter } from './routes/customers.js';
import { aiRouter } from './routes/ai.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/locations', locationsRouter);
app.use('/api/skus', skusRouter);
app.use('/api/customers', customersRouter);
app.use('/api/ai', aiRouter);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
