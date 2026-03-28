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
} from '../data/synthetic-network.js';

export const drpRouter = Router();

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

// ─── Helpers ────────────────────────────────────────────────────

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

// named export used by server/src/index.js
