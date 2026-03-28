/**
 * Demand Planning Route
 *
 * Endpoints:
 *   GET  /api/demand/history/:skuCode     — demand history (synthetic for now)
 *   POST /api/demand/forecast             — run forecast engine
 *   GET  /api/demand/demo/:skuCode        — run best-fit on synthetic data
 *   POST /api/demand/demo/:skuCode/analyze — forecast + AI analysis via SSE
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
import { demandHistory, getDemandWithPeriods } from '../data/synthetic-demand.js';
import { ValidationError } from '../middleware/error-handler.js';
import { triggerFullCascade } from '../services/cascade-handlers.js';

export const demandRouter = Router();

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

// Method dispatch table
const METHODS = {
  'sma': (params) => simpleMovingAverage(params),
  'wma': (params) => weightedMovingAverage(params),
  'ses': (params) => exponentialSmoothing(params),
  'holt': (params) => holtLinear(params),
  'holt-winters': (params) => holtWinters(params),
  'best-fit': (params) => bestFit(params),
};

// ─── GET /api/demand/history/:skuCode ─────────────────────────────

demandRouter.get('/history/:skuCode', (req, res) => {
  const data = getDemandWithPeriods(req.params.skuCode);
  if (!data) {
    return res.status(404).json({ error: `No demand history for ${req.params.skuCode}` });
  }
  res.json(data);
});

// ─── GET /api/demand/history — list all available SKUs ────────────

demandRouter.get('/history', (req, res) => {
  const skus = Object.entries(demandHistory).map(([code, data]) => ({
    skuCode: code,
    skuName: data.name,
    periods: data.weekly.length,
    avgDemand: Math.round(data.weekly.reduce((s, v) => s + v, 0) / data.weekly.length),
    lastDemand: data.weekly[data.weekly.length - 1],
  }));
  res.json({ skus });
});

// ─── POST /api/demand/forecast ────────────────────────────────────

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

    const result = methodFn({
      history,
      periods,
      ...params,
    });

    // Calculate accuracy metrics on fitted values
    const metrics = calculateMetrics({
      actuals: history,
      forecasts: result.fitted,
    });

    // Trigger the ASCM cascade: Demand -> DRP -> Prod Plan -> Scheduling -> MRP
    const cascadeResult = await triggerFullCascade({
      triggeredBy: 'demand-forecast',
    });

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
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/demand/demo/:skuCode — Best-fit on synthetic data ───

demandRouter.get('/demo/:skuCode', async (req, res, next) => {
  try {
    const data = getDemandWithPeriods(req.params.skuCode);
    if (!data) {
      throw new ValidationError(`No demand history for ${req.params.skuCode}`);
    }

    const periods = parseInt(req.query.periods) || 8;
    const result = bestFit({ history: data.demand, periods });

    const metrics = calculateMetrics({
      actuals: data.demand,
      forecasts: result.fitted,
    });

    // Build forecast periods
    const lastDate = new Date(data.periods[data.periods.length - 1]);
    const forecastPeriods = [];
    for (let i = 1; i <= periods; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i * 7);
      forecastPeriods.push(d.toISOString().slice(0, 10));
    }

    // Trigger the ASCM cascade: Demand -> DRP -> Prod Plan -> Scheduling -> MRP
    const cascadeResult = await triggerFullCascade({
      triggeredBy: 'demand-demo',
    });

    res.json({
      status: 'ok',
      skuCode: data.skuCode,
      skuName: data.skuName,
      bestMethod: result.bestMethod,
      history: {
        periods: data.periods,
        demand: data.demand,
      },
      forecast: {
        periods: forecastPeriods,
        demand: result.forecast,
      },
      fitted: result.fitted,
      metrics,
      allMethods: result.allMethods,
      cascade: {
        triggered: true,
        planRunId: cascadeResult.planRunId,
        queued: cascadeResult.queued || false,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/demand/demo/:skuCode/analyze — Demo + AI stream ───

demandRouter.post('/demo/:skuCode/analyze', async (req, res, next) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const data = getDemandWithPeriods(req.params.skuCode);
    if (!data) {
      throw new ValidationError(`No demand history for ${req.params.skuCode}`);
    }

    const { question } = req.body || {};
    const periods = 8;
    const result = bestFit({ history: data.demand, periods });
    const metrics = calculateMetrics({
      actuals: data.demand,
      forecasts: result.fitted,
    });

    const { systemPrompt, userMessage } = buildDemandContext({
      forecasts: result,
      history: data.demand,
      metrics,
      skuCode: data.skuCode,
      skuName: data.skuName,
      plannerQuestion: question,
    });

    // SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send deterministic results as first event
    res.write(`event: forecast-results\ndata: ${JSON.stringify({
      skuCode: data.skuCode,
      bestMethod: result.bestMethod,
      forecast: result.forecast,
      metrics,
    })}\n\n`);

    // Call Claude API
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
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
    if (!res.headersSent) {
      next(err);
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});
