/**
 * Cascade Route
 *
 * GET  /api/cascade/state   — SSE stream of cascade progress
 * GET  /api/cascade/status  — JSON snapshot of orchestrator state
 * POST /api/cascade/trigger — Trigger a full planning cascade
 * POST /api/cascade/reset   — Reset circuit breaker (admin)
 */

import { Router } from 'express';
import { cascade } from '../services/cascade.js';
import { triggerFullCascade } from '../services/cascade-handlers.js';

export const cascadeRouter = Router();

// SSE endpoint — client connects and receives real-time cascade updates
cascadeRouter.get('/state', (req, res) => {
  cascade.addSSEClient(res);
});

// JSON status snapshot
cascadeRouter.get('/status', (req, res) => {
  res.json(cascade.getStatus());
});

// Trigger a full cascade
cascadeRouter.post('/trigger', async (req, res) => {
  try {
    const { demandOverrides, isScenario } = req.body || {};
    const result = await triggerFullCascade({ demandOverrides, isScenario });
    res.json({ status: 'ok', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset circuit breaker
cascadeRouter.post('/reset', (req, res) => {
  cascade.resetCircuitBreaker();
  res.json({ status: 'ok', message: 'Circuit breaker reset' });
});
