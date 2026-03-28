import { Router } from 'express';
import { getDecisions, getTrustScore, logDecision, updateDecisionStatus, getDecisionById } from '../services/decision-service.js';
import { suggestResolutions, getLearningStats } from '../services/exception-learning.js';

export const decisionsRouter = Router();

// GET /api/decisions — list decisions with optional ?module= filter
decisionsRouter.get('/', (req, res, next) => {
  try {
    const { module, limit } = req.query;
    const decisions = getDecisions({
      module: module || 'all',
      limit: limit ? Number(limit) : undefined,
    });
    res.json(decisions);
  } catch (err) {
    next(err);
  }
});

// POST /api/decisions/suggest — suggest resolutions for exceptions
decisionsRouter.post('/suggest', (req, res, next) => {
  try {
    const { exceptions } = req.body;
    if (!exceptions || !Array.isArray(exceptions)) {
      return res.status(400).json({ error: 'exceptions array is required' });
    }
    const suggestions = suggestResolutions(exceptions);
    res.json(suggestions);
  } catch (err) {
    next(err);
  }
});

// GET /api/decisions/learning-stats — learning stats
decisionsRouter.get('/learning-stats', (req, res, next) => {
  try {
    const stats = getLearningStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/decisions/trust-score — trust score overall and per-module
decisionsRouter.get('/trust-score', (req, res, next) => {
  try {
    const { module } = req.query;
    const score = getTrustScore({ module });
    res.json(score);
  } catch (err) {
    next(err);
  }
});

// POST /api/decisions — log a new decision
decisionsRouter.post('/', (req, res, next) => {
  try {
    const { module, action, entityType, entityId, entity, rationale, decidedBy, financialImpact, status } = req.body;
    if (!module || !action) {
      return res.status(400).json({ error: 'module and action are required' });
    }
    const decision = logDecision({
      module, action, entityType, entityId,
      entity: entity || entityId,
      rationale, decidedBy, financialImpact, status,
    });
    res.status(201).json(decision);
  } catch (err) {
    next(err);
  }
});

// PUT /api/decisions/:id/status — update decision status (accept/defer/dismiss)
decisionsRouter.put('/:id/status', (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['accepted', 'deferred', 'dismissed', 'pending'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }
    const decision = updateDecisionStatus(id, status);
    if (!decision) {
      return res.status(404).json({ error: `Decision ${id} not found` });
    }
    res.json(decision);
  } catch (err) {
    next(err);
  }
});
