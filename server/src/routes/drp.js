/**
 * DRP Routes — Distribution Requirements Planning
 *
 * ASCM cascade: Demand Plan → DRP → S&OP → MPS (RCCP) → [MRP + Scheduling]
 *
 * DRP operates on the distribution network:
 *   - Input: DC-level demand forecast + DC inventory
 *   - Output: Planned shipments per DC + aggregated plant-level gross requirements
 *   - Multi-plant: DRP assigns demand to specific plants via sourcing rules
 */

import { Router } from 'express';
import { runDRP, fairShareAllocation } from '../engines/drp-engine.js';
import { buildDRPContext } from '../services/ai-context/drp-context.js';
import {
  networkLocations,
  networkLanes,
  dcInventory,
  dcDemandForecast,
  plantInventory,
  products,
  productSourcing,
  getBestSourceForDC,
  getDCs,
  getPlants,
} from '../services/data-provider.js';
import { attachFinancialImpacts } from '../services/financial-impact.js';

export const drpRouter = Router();

// ─── In-memory approved shipments store ──────────────────────────
const approvedShipments = {};

/**
 * GET /api/drp/demo
 * Run DRP across all 10 products × 3 DCs, aggregate to 3 plants
 */
drpRouter.get('/demo', (req, res) => {
  try {
    const periods = makePeriods(8);
    const dcCodes = getDCs().map(d => d.code);
    const results = [];

    for (const product of products) {
      const sku = product.code;
      const locations = [];

      for (const dc of dcCodes) {
        const inv = dcInventory[dc]?.[sku];
        const demand = dcDemandForecast[dc]?.[sku];
        if (!inv || !demand) continue;

        // Find best source plant for this DC + product combo
        const lane = getBestSourceForDC(dc, sku);
        if (!lane) continue;

        locations.push({
          code: dc,
          onHand: inv.onHand,
          safetyStock: inv.safetyStock,
          scheduledReceipts: inv.scheduledReceipts || periods.map(() => 0),
          grossReqs: demand,
          transitLeadTime: lane.leadTimePeriods,
          sourceCode: lane.source,
        });
      }

      if (locations.length === 0) continue;

      const drpResult = runDRP({ skuCode: sku, periods, locations });
      results.push(drpResult);
    }

    // Aggregate plant requirements across ALL products
    const plantAggregates = {};
    for (const plant of getPlants()) {
      plantAggregates[plant.code] = {
        totalGrossReqs: new Array(8).fill(0),
        byProduct: {},
      };
    }

    for (const result of results) {
      if (!result.plantRequirements?.byDC) continue;
      const plantCode = result.plantRequirements.plantCode;
      if (!plantAggregates[plantCode]) {
        plantAggregates[plantCode] = { totalGrossReqs: new Array(8).fill(0), byProduct: {} };
      }
      const agg = plantAggregates[plantCode];
      agg.byProduct[result.skuCode] = result.plantRequirements.grossReqs;
      for (let i = 0; i < 8; i++) {
        agg.totalGrossReqs[i] += result.plantRequirements.grossReqs[i] || 0;
      }
    }

    // Attach per-exception financial impact
    results.forEach(r => {
      if (r.exceptions) r.exceptions = attachFinancialImpacts(r.exceptions);
    });

    const totalExceptions = results.reduce((s, r) => s + (r.exceptions?.length || 0), 0);
    const criticalExceptions = results.reduce(
      (s, r) => s + (r.exceptions?.filter(e => e.severity === 'critical').length || 0), 0
    );

    res.json({
      periods,
      skusPlanned: results.length,
      locationsPlanned: dcCodes.length,
      plantsServed: Object.keys(plantAggregates).length,
      totalExceptions,
      criticalExceptions,
      network: { locations: networkLocations, lanes: networkLanes },
      plantInventory,
      plantAggregates,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/drp/demo/:skuCode
 */
drpRouter.get('/demo/:skuCode', (req, res) => {
  try {
    const { skuCode } = req.params;
    const periods = makePeriods(8);
    const dcCodes = getDCs().map(d => d.code);

    const locations = dcCodes
      .filter(dc => dcDemandForecast[dc]?.[skuCode] && dcInventory[dc]?.[skuCode])
      .map(dc => {
        const inv = dcInventory[dc][skuCode];
        const demand = dcDemandForecast[dc][skuCode];
        const lane = getBestSourceForDC(dc, skuCode);
        return {
          code: dc,
          onHand: inv.onHand,
          safetyStock: inv.safetyStock,
          scheduledReceipts: inv.scheduledReceipts || periods.map(() => 0),
          grossReqs: demand,
          transitLeadTime: lane?.leadTimePeriods || 1,
          sourceCode: lane?.source || 'PLANT-NORTH',
        };
      });

    if (locations.length === 0) {
      return res.status(404).json({ error: `No demand data for SKU ${skuCode}` });
    }

    const result = runDRP({ skuCode, periods, locations });
    res.json({ periods, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

/**
 * POST /api/drp/demo/analyze — DRP + AI stream
 */
drpRouter.post('/demo/analyze', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const { question } = req.body || {};
    const periods = makePeriods(8);
    const dcCodes = getDCs().map(d => d.code);
    const results = [];

    for (const product of products) {
      const sku = product.code;
      const locations = [];
      for (const dc of dcCodes) {
        const inv = dcInventory[dc]?.[sku];
        const demand = dcDemandForecast[dc]?.[sku];
        if (!inv || !demand) continue;
        const lane = getBestSourceForDC(dc, sku);
        if (!lane) continue;
        locations.push({
          code: dc, onHand: inv.onHand, safetyStock: inv.safetyStock,
          scheduledReceipts: inv.scheduledReceipts || periods.map(() => 0),
          grossReqs: demand, transitLeadTime: lane.leadTimePeriods, sourceCode: lane.source,
        });
      }
      if (locations.length === 0) continue;
      results.push(runDRP({ skuCode: sku, periods, locations }));
    }

    const { systemPrompt, userMessage } = buildDRPContext({
      results, network: { locations: networkLocations, lanes: networkLanes },
      plantInventory, periods,
    });

    // Prepend planner question if provided
    const finalUserMessage = question
      ? `${userMessage}\n\n---\nPlanner's question: ${question}`
      : userMessage;

    // SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const totalExceptions = results.reduce((s, r) => s + (r.exceptions?.length || 0), 0);
    res.write(`event: drp-results\ndata: ${JSON.stringify({
      skusPlanned: results.length, totalExceptions,
    })}\n\n`);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: finalUserMessage }],
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
      res.status(500).json({ error: err.message });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * POST /api/drp/fair-share
 */
drpRouter.post('/fair-share', (req, res) => {
  try {
    const { available, demands } = req.body;
    if (available == null || !Array.isArray(demands)) {
      return res.status(400).json({ error: 'Required: available, demands' });
    }
    res.json({ available, allocation: fairShareAllocation({ available, demands }) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/drp/network
 */
drpRouter.get('/network', (_req, res) => {
  res.json({
    locations: networkLocations,
    lanes: networkLanes,
    plantInventory,
    dcInventory,
    products,
    productSourcing,
  });
});

/**
 * POST /api/drp/run
 */
drpRouter.post('/run', (req, res) => {
  try {
    const { skuCode, periods, locations } = req.body;
    if (!skuCode || !periods || !locations) {
      return res.status(400).json({ error: 'Required: skuCode, periods, locations' });
    }
    res.json(runDRP({ skuCode, periods, locations }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Shipment Approval ───────��──────────────────────────────────

/**
 * PUT /api/drp/approve-shipment — mark a planned shipment as approved
 */
drpRouter.put('/approve-shipment', (req, res) => {
  try {
    const { skuCode, locationCode, period } = req.body;
    if (!skuCode || !locationCode || !period) {
      return res.status(400).json({ error: 'Required: skuCode, locationCode, period' });
    }
    const key = `${skuCode}:${locationCode}:${period}`;
    approvedShipments[key] = true;
    res.json({ status: 'ok', key, approved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/drp/approved-shipments — list all approved shipments
 */
drpRouter.get('/approved-shipments', (_req, res) => {
  res.json({ approved: approvedShipments });
});

// ─── Helpers ───���────────────────────────────────────────────────

function makePeriods(count) {
  const periods = [];
  const base = new Date('2026-04-07');
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    periods.push(d.toISOString().slice(0, 10));
  }
  return periods;
}

// ─────────────────────────────────────────────────────────────────────────────
// Champion DRP Endpoints — Distribution Planning, Load Manager, Move vs Make
// ─────────────────────────────────────────────────────────────────────────────

let _drpStore = null;
async function getDrpStore() {
  if (!_drpStore) _drpStore = await import('../data/champion-drp-store.js');
  return _drpStore;
}

// GET /api/drp/distribution-plan — full distribution plan overview
drpRouter.get('/distribution-plan', async (req, res, next) => {
  try {
    const s = await getDrpStore();
    if (!s.isInitialized()) return res.status(503).json({ error: 'DRP store not initialized' });

    res.json({
      summary: s.getDistributionSummary(),
      lanes: s.getLanes(),
      demandSplits: s.getDemandSplits(),
      calendars: s.getShippingCalendars(),
      dcInventory: s.getDCInventory(),
    });
  } catch (err) { next(err); }
});

// GET /api/drp/recommended-shipments?lane=PLT-DOGSTAR|DC-ATL
drpRouter.get('/recommended-shipments', async (req, res, next) => {
  try {
    const s = await getDrpStore();
    const { lane } = req.query;
    res.json({
      shipments: s.getRecommendedShipments(lane || null),
      pendingLoads: s.getPendingLoads(),
      committedLoads: s.getCommittedLoads(),
    });
  } catch (err) { next(err); }
});

// POST /api/drp/combine-shipments — create pending load
drpRouter.post('/combine-shipments', async (req, res, next) => {
  try {
    const s = await getDrpStore();
    const { shipmentIds } = req.body;
    const result = s.combineShipments(shipmentIds || []);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /api/drp/pending-load/:loadId — uncombine pending load
drpRouter.delete('/pending-load/:loadId', async (req, res, next) => {
  try {
    const s = await getDrpStore();
    const result = s.uncommitLoad(req.params.loadId);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/drp/commit-load — finalize load
drpRouter.post('/commit-load', async (req, res, next) => {
  try {
    const s = await getDrpStore();
    const { loadId } = req.body;
    const result = s.commitLoad(loadId);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/drp/committed-loads
drpRouter.get('/committed-loads', async (req, res, next) => {
  try {
    const s = await getDrpStore();
    res.json({ loads: s.getCommittedLoads() });
  } catch (err) { next(err); }
});

// PUT /api/drp/demand-split — update family allocation across DCs
drpRouter.put('/demand-split', async (req, res, next) => {
  try {
    const s = await getDrpStore();
    const { familyId, allocations } = req.body;
    const result = s.updateDemandSplit(familyId, allocations);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

// PUT /api/drp/shipping-calendar — update calendar for a lane
drpRouter.put('/shipping-calendar', async (req, res, next) => {
  try {
    const s = await getDrpStore();
    const { laneKey, shipDays, frequency } = req.body;
    const result = s.updateShippingCalendar(laneKey, { shipDays, frequency });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/drp/move-vs-make/scenarios
drpRouter.get('/move-vs-make/scenarios', async (req, res, next) => {
  try {
    const s = await getDrpStore();
    res.json({ scenarios: s.getMoveVsMakeScenarios() });
  } catch (err) { next(err); }
});

// GET /api/drp/move-vs-make/:scenarioId
drpRouter.get('/move-vs-make/:scenarioId', async (req, res, next) => {
  try {
    const s = await getDrpStore();
    const scenario = s.getMoveVsMakeDetail(req.params.scenarioId);
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    res.json(scenario);
  } catch (err) { next(err); }
});

// POST /api/drp/move-vs-make/:scenarioId/execute
drpRouter.post('/move-vs-make/:scenarioId/execute', async (req, res, next) => {
  try {
    const s = await getDrpStore();
    const { decision } = req.body;
    if (!['move', 'make'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be "move" or "make"' });
    }
    const result = s.executeMoveVsMake(req.params.scenarioId, decision);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

// named export used by server/src/index.js
