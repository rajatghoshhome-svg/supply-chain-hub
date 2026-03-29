import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { locationsRouter } from './routes/locations.js';
import { skusRouter } from './routes/skus.js';
import { customersRouter } from './routes/customers.js';
import { aiRouter } from './routes/ai.js';
import { mrpRouter } from './routes/mrp.js';
import { importRouter } from './routes/import.js';
import { cascadeRouter } from './routes/cascade.js';
import { demandRouter } from './routes/demand.js';
import { drpRouter } from './routes/drp.js';
import { productionPlanRouter } from './routes/production-plan.js';
import { schedulingRouter } from './routes/scheduling.js';
import { networkRouter } from './routes/network.js';
import { briefingRouter } from './routes/briefing.js';
import { decisionsRouter } from './routes/decisions.js';
import { externalRisksRouter } from './routes/external-risks.js';
import { onboardingRouter } from './routes/onboarding.js';
import { settingsRouter } from './routes/settings.js';
import { requestId, errorHandler } from './middleware/error-handler.js';
import { initialize as initChampionStore } from './data/champion-store.js';
import { initialize as initDrpStore } from './data/champion-drp-store.js';
import { initialize as initProductionStore } from './data/champion-production-store.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large CSV imports
app.use(requestId); // Add request ID to every request

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/locations', locationsRouter);
app.use('/api/skus', skusRouter);
app.use('/api/customers', customersRouter);
app.use('/api/ai', aiRouter);
app.use('/api/mrp', mrpRouter);
app.use('/api/import', importRouter);
app.use('/api/cascade', cascadeRouter);
app.use('/api/demand', demandRouter);
app.use('/api/drp', drpRouter);
app.use('/api/production-plan', productionPlanRouter);
app.use('/api/scheduling', schedulingRouter);
app.use('/api/network', networkRouter);
app.use('/api/briefing', briefingRouter);
app.use('/api/decisions', decisionsRouter);
app.use('/api/external-risks', externalRisksRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/settings', settingsRouter);

// Error handling
app.use(errorHandler);

// Initialize Champion Pet Foods data stores on startup
initChampionStore();
initDrpStore();
initProductionStore();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
