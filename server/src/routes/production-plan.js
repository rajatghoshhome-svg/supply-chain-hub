/**
 * Production Planning Routes — S&OP + MPS (RCCP)
 *
 * ASCM cascade: Demand → DRP → S&OP/Prod Plan → MPS (RCCP) → [MRP + Scheduling]
 *
 * Two levels:
 *   1. S&OP (Aggregate): Product family level, chase/level/hybrid strategies
 *   2. MPS (RCCP): End-item level, rough-cut capacity validation
 *
 * Input: Plant-level gross requirements from DRP (per plant, per product)
 * Output: Production plan per plant + RCCP validation
 */

import { Router } from 'express';
import { runProductionPlan, roughCutCapacity } from '../engines/prod-plan-engine.js';
import { runDRP } from '../engines/drp-engine.js';
import { buildProductionContext } from '../services/ai-context/production-context.js';
import {
  networkLanes,
  dcInventory,
  dcDemandForecast,
  plantInventory,
  products,
  productFamilies,
  plantWorkCenters,
  getProductsForPlant,
  getPlants,
  getDCs,
  getBestSourceForDC,
} from '../data/synthetic-network.js';

export const productionPlanRouter = Router();

/**
 * GET /api/production-plan/demo
 * Full cascade: DRP → S&OP → MPS per plant
 */
productionPlanRouter.get('/demo', (req, res) => {
  try {
    const periods = makePeriods(8);
    const dcCodes = getDCs().map(d => d.code);

    // Step 1: Run DRP for all products to get plant-level gross requirements
    const plantGrossReqs = {}; // { plantCode: { skuCode: [reqs] } }
    const drpExceptions = [];

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
      drpExceptions.push(...(drpResult.exceptions || []));

      // Collect plant-level gross requirements
      const plantCode = drpResult.plantRequirements?.plantCode;
      if (plantCode) {
        if (!plantGrossReqs[plantCode]) plantGrossReqs[plantCode] = {};
        plantGrossReqs[plantCode][sku] = drpResult.plantRequirements.grossReqs;
      }
    }

    // Step 2: Run production plan per plant
    const plantResults = [];

    for (const plant of getPlants()) {
      const pc = plant.code;
      const productReqs = plantGrossReqs[pc] || {};
      const plantProducts = getProductsForPlant(pc);

      // Per-product MPS with RCCP
      const productPlans = [];
      for (const skuCode of plantProducts) {
        const grossReqs = productReqs[skuCode] || new Array(8).fill(0);
        const inv = plantInventory[pc]?.[skuCode] || { onHand: 0, safetyStock: 0 };
        const prod = products.find(p => p.code === skuCode);
        const family = productFamilies.find(f => f.products.includes(skuCode));

        // Get work center hours for this product's family
        const wcs = (plantWorkCenters[pc] || []).map(wc => ({
          code: wc.code,
          hoursPerUnit: wc.hoursPerUnit[family?.code] || 1.0,
          capacityHoursPerPeriod: wc.capacityHoursPerWeek,
        })).filter(wc => wc.hoursPerUnit > 0);

        const plan = runProductionPlan({
          periods,
          grossReqs,
          beginningInventory: inv.onHand,
          costPerUnit: prod?.unitCost || 100,
          inventoryCarryingCost: (prod?.unitCost || 100) * 0.005, // 0.5% weekly
          hiringCostPerUnit: 5,
          layoffCostPerUnit: 8,
          baseRate: Math.ceil(grossReqs.reduce((a, b) => a + b, 0) / 8 * 1.1),
          maxOvertimeRate: Math.ceil(grossReqs.reduce((a, b) => a + b, 0) / 8 * 0.3),
          overtimeCostPremium: 1.5,
          subcontractCostPremium: 2.0,
          workCenters: wcs,
        });

        productPlans.push({
          skuCode,
          skuName: prod?.name,
          family: family?.code,
          plantGrossReqs: grossReqs,
          plan,
        });
      }

      // Aggregate RCCP across all products for this plant
      const aggregateProduction = new Array(8).fill(0);
      for (const pp of productPlans) {
        const strategy = pp.plan.strategies[pp.plan.recommended];
        for (let i = 0; i < 8; i++) {
          aggregateProduction[i] += strategy.production[i] || 0;
        }
      }

      const aggregateRCCP = roughCutCapacity({
        periods,
        production: aggregateProduction,
        workCenters: (plantWorkCenters[pc] || []).map(wc => ({
          code: wc.code,
          hoursPerUnit: 1.0,  // aggregate: 1 unit = 1 hour (simplified)
          capacityHoursPerPeriod: wc.capacityHoursPerWeek,
        })),
      });

      plantResults.push({
        plantCode: pc,
        plantName: plant.name,
        weeklyCapacity: plant.weeklyCapacity,
        productsPlanned: productPlans.length,
        aggregateProduction,
        aggregateRCCP,
        productPlans,
      });
    }

    res.json({
      periods,
      plantResults,
      drpExceptionsCount: drpExceptions.length,
      productFamilies,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

/**
 * POST /api/production-plan/demo/analyze — Production Plan + AI stream
 */
productionPlanRouter.post('/demo/analyze', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const { question } = req.body || {};
    const periods = makePeriods(8);
    const dcCodes = getDCs().map(d => d.code);

    // Run the same DRP → Prod Plan cascade as /demo
    const plantGrossReqs = {};
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
      const drpResult = runDRP({ skuCode: sku, periods, locations });
      const plantCode = drpResult.plantRequirements?.plantCode;
      if (plantCode) {
        if (!plantGrossReqs[plantCode]) plantGrossReqs[plantCode] = {};
        plantGrossReqs[plantCode][sku] = drpResult.plantRequirements.grossReqs;
      }
    }

    // Build plant plans for AI context
    const plantPlan = {};
    const rccp = {};
    for (const plant of getPlants()) {
      const pc = plant.code;
      const productReqs = plantGrossReqs[pc] || {};
      const plantProds = getProductsForPlant(pc);
      const aggregateProduction = new Array(8).fill(0);
      const strategies = {};

      for (const skuCode of plantProds) {
        const grossReqs = productReqs[skuCode] || new Array(8).fill(0);
        const inv = plantInventory[pc]?.[skuCode] || { onHand: 0 };
        const prod = products.find(p => p.code === skuCode);
        const plan = runProductionPlan({
          periods, grossReqs, beginningInventory: inv.onHand,
          costPerUnit: prod?.unitCost || 100,
        });
        const recommended = plan.strategies[plan.recommended];
        for (let i = 0; i < 8; i++) aggregateProduction[i] += recommended.production[i] || 0;
      }

      // Aggregate plan for this plant
      const totalGross = new Array(8).fill(0);
      for (const reqs of Object.values(productReqs)) {
        for (let i = 0; i < 8; i++) totalGross[i] += reqs[i] || 0;
      }

      const aggPlan = runProductionPlan({
        periods, grossReqs: totalGross, beginningInventory: 0, costPerUnit: 100,
      });

      plantPlan[pc] = { strategies: aggPlan.strategies, recommended: aggPlan.recommended, grossReqs: totalGross };

      // RCCP
      const aggRCCP = roughCutCapacity({
        periods, production: aggregateProduction,
        workCenters: (plantWorkCenters[pc] || []).map(wc => ({
          code: wc.code, name: wc.name, hoursPerUnit: 1.0,
          capacityHoursPerPeriod: wc.capacityHoursPerWeek,
        })),
      });
      rccp[pc] = aggRCCP;
    }

    const { systemPrompt, userMessage } = buildProductionContext({
      plantPlan, periods, rccp, plannerQuestion: question,
    });

    // SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`event: plan-results\ndata: ${JSON.stringify({ periods, plantPlan: Object.keys(plantPlan) })}\n\n`);

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
      res.status(500).json({ error: err.message });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * POST /api/production-plan/run
 */
productionPlanRouter.post('/run', (req, res) => {
  try {
    res.json(runProductionPlan(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
