/**
 * Demand Planning Routes — Champion Pet Foods
 *
 * New hierarchical endpoints:
 *   GET  /api/demand/hierarchy          — full product tree for navigator
 *   GET  /api/demand/dimensions         — available pivot dimensions
 *   GET  /api/demand/history            — demand history at any hierarchy level
 *   GET  /api/demand/forecast           — stat + final forecast at any level
 *   POST /api/demand/override           — apply override (disaggregates if aggregate level)
 *   GET  /api/demand/accuracy           — forecast accuracy bars + metrics
 *   GET  /api/demand/summary            — store summary / diagnostics
 *   POST /api/demand/reset-overrides    — reset final forecast to stat
 *   POST /api/demand/publish            — publish demand plan → trigger cascade
 *
 * Legacy endpoints (backward compat):
 *   GET  /api/demand/history/:skuCode   — single SKU history (Peakline format)
 *   POST /api/demand/forecast           — raw forecast engine (method dispatch)
 *   GET  /api/demand/demo/:skuCode      — best-fit demo
 *   POST /api/demand/demo/:skuCode/analyze — forecast + AI stream
 */

import { Router } from 'express';
import {
  simpleMovingAverage,
  weightedMovingAverage,
  exponentialSmoothing,
  holtLinear,
  holtWinters,
  calculateMetrics,
  bestFit,
} from '../engines/demand-engine.js';
import { buildDemandContext } from '../services/ai-context/demand-context.js';
import { ValidationError } from '../middleware/error-handler.js';
import { triggerFullCascade } from '../services/cascade-handlers.js';

// Champion store — imported lazily to avoid circular deps at module load
let store = null;
function getStore() {
  if (!store) {
    store = import('../data/champion-store.js');
  }
  return store;
}

// Legacy Peakline imports — only used for backward-compat routes
let _legacyProvider = null;
async function getLegacy() {
  if (!_legacyProvider) {
    try {
      _legacyProvider = await import('../services/data-provider.js');
    } catch {
      _legacyProvider = {};
    }
  }
  return _legacyProvider;
}

export const demandRouter = Router();

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Hierarchical Demand Endpoints
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/demand/hierarchy — full product tree for the navigator
demandRouter.get('/hierarchy', async (req, res, next) => {
  try {
    const s = await getStore();
    res.json({
      tree: s.getHierarchy(),
      customers: s.getCustomers(),
    });
  } catch (err) { next(err); }
});

// GET /api/demand/dimensions — available pivot dimensions and their values
demandRouter.get('/dimensions', async (req, res, next) => {
  try {
    const s = await getStore();
    res.json(s.getDimensions());
  } catch (err) { next(err); }
});

// GET /api/demand/summary — store diagnostics
demandRouter.get('/summary', async (req, res, next) => {
  try {
    const s = await getStore();
    res.json(s.getStoreSummary());
  } catch (err) { next(err); }
});

// GET /api/demand/history?level=family&id=ORI-DOG-DRY&customer=PETCO
// Returns weekly demand at any hierarchy level, optionally filtered by customer
demandRouter.get('/history', async (req, res, next) => {
  try {
    const { level = 'all', id = 'all', customer } = req.query;
    const s = await getStore();

    const history = s.getHistory(level, id, customer || null);
    const weekDates = s.getWeekDates();
    const breadcrumb = level !== 'all' ? s.getBreadcrumb(level, id) : [];
    const children = s.getChildren(level, id);
    const skuCount = s.getSkuIdsForLevel(level, id).length;

    res.json({
      level,
      id,
      customer: customer || null,
      breadcrumb,
      children,
      skuCount,
      periods: weekDates,
      history,
      total: history.reduce((s, v) => s + v, 0),
      avgWeekly: Math.round(history.reduce((s, v) => s + v, 0) / history.length),
    });
  } catch (err) { next(err); }
});

// GET /api/demand/forecast?level=product&id=ORI-ORIG&customer=PETCO
// Returns stat forecast, final forecast, history, and method info
demandRouter.get('/forecast', async (req, res, next) => {
  try {
    const { level = 'all', id = 'all', customer } = req.query;
    const s = await getStore();

    const history = s.getHistory(level, id, customer || null);
    const statForecast = s.getStatForecast(level, id, customer || null);
    const finalForecast = s.getFinalForecast(level, id, customer || null);
    const method = s.getForecastMethod(level, id, customer || null);
    const weekDates = s.getWeekDates();
    const breadcrumb = level !== 'all' ? s.getBreadcrumb(level, id) : [];
    const children = s.getChildren(level, id);
    const overrides = s.getOverrides(level, id, customer || null);
    const skuCount = s.getSkuIdsForLevel(level, id).length;

    // Build forecast period dates (continuing from last history date)
    const lastHistDate = new Date(weekDates[weekDates.length - 1]);
    const forecastDates = [];
    for (let i = 1; i <= statForecast.length; i++) {
      const d = new Date(lastHistDate);
      d.setDate(d.getDate() + i * 7);
      forecastDates.push(d.toISOString().split('T')[0]);
    }

    res.json({
      level,
      id,
      customer: customer || null,
      breadcrumb,
      children,
      skuCount,
      method,
      historyPeriods: weekDates,
      forecastPeriods: forecastDates,
      history,
      statForecast,
      finalForecast,
      overrideCount: overrides.length,
      hasOverrides: overrides.length > 0,
    });
  } catch (err) { next(err); }
});

// POST /api/demand/override
// Body: { level, id, customer, overrides: { periodIndex: value }, reason }
// If level > SKU, disaggregates proportionally to children
demandRouter.post('/override', async (req, res, next) => {
  try {
    const { level, id, customer, overrides, reason = 'Manual' } = req.body;

    if (!level || !id || !overrides || Object.keys(overrides).length === 0) {
      throw new ValidationError('level, id, and overrides object required');
    }

    const s = await getStore();
    const results = [];

    for (const [periodStr, value] of Object.entries(overrides)) {
      const periodIndex = parseInt(periodStr);
      if (isNaN(periodIndex) || periodIndex < 0) continue;

      const result = s.applyOverride(
        level, id, customer || null,
        periodIndex, Number(value), reason
      );
      results.push({ period: periodIndex, ...result });
    }

    // Get updated forecast to return
    const finalForecast = s.getFinalForecast(level, id, customer || null);

    res.json({
      status: 'ok',
      level,
      id,
      customer: customer || null,
      adjustments: results,
      finalForecast,
    });
  } catch (err) { next(err); }
});

// POST /api/demand/reset-overrides
// Body: { level, id, customer }
demandRouter.post('/reset-overrides', async (req, res, next) => {
  try {
    const { level = 'all', id = 'all', customer } = req.body;
    const s = await getStore();
    const result = s.resetOverrides(level, id, customer || null);
    res.json({ status: 'ok', ...result });
  } catch (err) { next(err); }
});

// GET /api/demand/accuracy?level=product&id=ORI-ORIG&customer=PETCO
// Returns period-by-period accuracy bars + summary metrics
demandRouter.get('/accuracy', async (req, res, next) => {
  try {
    const { level = 'all', id = 'all', customer } = req.query;
    const s = await getStore();

    const accuracy = s.getAccuracyMetrics(level, id, customer || null);
    const breadcrumb = level !== 'all' ? s.getBreadcrumb(level, id) : [];

    res.json({
      level,
      id,
      customer: customer || null,
      breadcrumb,
      metrics: accuracy.statMetrics,
      bars: accuracy.bars,
    });
  } catch (err) { next(err); }
});

// POST /api/demand/publish — publish demand plan, trigger full ASCM cascade
demandRouter.post('/publish', async (req, res, next) => {
  try {
    const s = await getStore();
    const summary = s.getStoreSummary();

    const cascadeResult = await triggerFullCascade({
      triggeredBy: 'demand-publish',
    });

    res.json({
      status: 'ok',
      message: `Published demand plan for ${summary.skus} SKUs × ${summary.customers} customers`,
      overrides: summary.totalOverrides,
      cascade: {
        triggered: true,
        planRunId: cascadeResult.planRunId,
        queued: cascadeResult.queued || false,
      },
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: Backward-compatible endpoints (Peakline format)
// These still work for the other modules that haven't been updated yet.
// ─────────────────────────────────────────────────────────────────────────────

// Method dispatch table for raw forecast endpoint
const METHODS = {
  'sma': (params) => simpleMovingAverage(params),
  'wma': (params) => weightedMovingAverage(params),
  'ses': (params) => exponentialSmoothing(params),
  'holt': (params) => holtLinear(params),
  'holt-winters': (params) => holtWinters(params),
  'best-fit': (params) => bestFit(params),
};

// GET /api/demand/history/:skuCode — single SKU history (legacy)
demandRouter.get('/history/:skuCode', async (req, res) => {
  const legacy = await getLegacy();
  if (legacy.getDemandWithPeriods) {
    const data = legacy.getDemandWithPeriods(req.params.skuCode);
    if (!data) {
      return res.status(404).json({ error: `No demand history for ${req.params.skuCode}` });
    }
    return res.json(data);
  }
  res.status(404).json({ error: 'Legacy data provider not available' });
});

// POST /api/demand/forecast (legacy — raw method dispatch)
// Note: this is differentiated from GET /forecast by method
demandRouter.post('/forecast', async (req, res, next) => {
  try {
    const { history, method, periods = 8, params = {} } = req.body;

    if (!history || !Array.isArray(history) || history.length === 0) {
      throw new ValidationError('history array is required', { field: 'history' });
    }
    if (!method) {
      throw new ValidationError('method is required (sma, wma, ses, holt, holt-winters, best-fit)', { field: 'method' });
    }

    const methodFn = METHODS[method];
    if (!methodFn) {
      throw new ValidationError(`Unknown method: ${method}. Valid: ${Object.keys(METHODS).join(', ')}`, { field: 'method' });
    }

    const result = methodFn({ history, periods, ...params });
    const metrics = calculateMetrics({ actuals: history, forecasts: result.fitted });

    const cascadeResult = await triggerFullCascade({ triggeredBy: 'demand-forecast' });

    res.json({
      status: 'ok',
      method: result.method || method,
      forecast: result.forecast,
      fitted: result.fitted,
      metrics,
      ...(result.allMethods && { allMethods: result.allMethods }),
      ...(result.bestMethod && { bestMethod: result.bestMethod }),
      cascade: {
        triggered: true,
        planRunId: cascadeResult.planRunId,
        queued: cascadeResult.queued || false,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/demand/demo/:skuCode — best-fit on synthetic data (legacy)
demandRouter.get('/demo/:skuCode', async (req, res, next) => {
  try {
    const legacy = await getLegacy();
    const data = legacy.getDemandWithPeriods?.(req.params.skuCode);
    if (!data) {
      throw new ValidationError(`No demand history for ${req.params.skuCode}`);
    }

    const periods = parseInt(req.query.periods) || 8;
    const result = bestFit({ history: data.demand, periods });
    const metrics = calculateMetrics({ actuals: data.demand, forecasts: result.fitted });

    const lastDate = new Date(data.periods[data.periods.length - 1]);
    const forecastPeriods = [];
    for (let i = 1; i <= periods; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i * 7);
      forecastPeriods.push(d.toISOString().slice(0, 10));
    }

    const cascadeResult = await triggerFullCascade({ triggeredBy: 'demand-demo' });

    res.json({
      status: 'ok',
      skuCode: data.skuCode,
      skuName: data.skuName,
      bestMethod: result.bestMethod,
      history: { periods: data.periods, demand: data.demand },
      forecast: { periods: forecastPeriods, demand: result.forecast },
      fitted: result.fitted,
      metrics,
      allMethods: result.allMethods,
      cascade: { triggered: true, planRunId: cascadeResult.planRunId, queued: cascadeResult.queued || false },
    });
  } catch (err) { next(err); }
});

// POST /api/demand/demo/:skuCode/analyze — Demo + AI stream (legacy)
demandRouter.post('/demo/:skuCode/analyze', async (req, res, next) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const legacy = await getLegacy();
    const data = legacy.getDemandWithPeriods?.(req.params.skuCode);
    if (!data) {
      throw new ValidationError(`No demand history for ${req.params.skuCode}`);
    }

    const { question } = req.body || {};
    const periods = 8;
    const result = bestFit({ history: data.demand, periods });
    const metrics = calculateMetrics({ actuals: data.demand, forecasts: result.fitted });

    const { systemPrompt, userMessage } = buildDemandContext({
      forecasts: result, history: data.demand, metrics,
      skuCode: data.skuCode, skuName: data.skuName,
      plannerQuestion: question,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`event: forecast-results\ndata: ${JSON.stringify({
      skuCode: data.skuCode, bestMethod: result.bestMethod,
      forecast: result.forecast, metrics,
    })}\n\n`);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        stream: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      res.write(`event: error\ndata: ${JSON.stringify({ error: `API error ${response.status}: ${body}` })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) { next(err); }
    else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// Legacy override endpoints (keep for backward compat)
const legacyOverrides = {};

demandRouter.put('/override', async (req, res, next) => {
  try {
    const { skuCode, overrides } = req.body;
    if (!skuCode || !overrides || Object.keys(overrides).length === 0) {
      throw new ValidationError('skuCode and overrides object required');
    }

    const normalized = {};
    for (const [period, val] of Object.entries(overrides)) {
      if (typeof val === 'number') {
        normalized[period] = { value: val, reason: 'Manual' };
      } else if (val && typeof val === 'object' && val.value != null) {
        normalized[period] = { value: val.value, reason: val.reason || 'Manual' };
      } else {
        normalized[period] = { value: Number(val), reason: 'Manual' };
      }
    }

    if (!legacyOverrides[skuCode]) legacyOverrides[skuCode] = {};
    Object.assign(legacyOverrides[skuCode], normalized);

    const cascadeResult = await triggerFullCascade({
      triggeredBy: 'demand-override',
      demandOverrides: { [skuCode]: overrides },
    });

    res.json({
      status: 'ok', skuCode,
      overrides: legacyOverrides[skuCode],
      cascade: { triggered: true, planRunId: cascadeResult.planRunId },
    });
  } catch (err) { next(err); }
});

demandRouter.get('/overrides/:skuCode', (req, res) => {
  const overrides = legacyOverrides[req.params.skuCode] || {};
  res.json({ skuCode: req.params.skuCode, overrides });
});

demandRouter.get('/overrides', (req, res) => {
  const result = Object.entries(legacyOverrides).map(([skuCode, overrides]) => ({
    skuCode, overrides, periodCount: Object.keys(overrides).length,
  }));
  res.json({ overrides: result });
});
