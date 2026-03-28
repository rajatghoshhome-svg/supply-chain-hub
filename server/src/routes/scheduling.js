/**
 * Production Scheduling Routes — Operator/Gantt Level
 *
 * ASCM cascade: Demand → DRP → S&OP → MPS (RCCP) → [MRP + Scheduling ⟲]
 *
 * Scheduling receives the MPS output (what to produce, when) and creates
 * a detailed sequence on work centers with:
 *   - Forward scheduling from earliest start
 *   - Sequencing rules (SPT, EDD, CR)
 *   - Changeover time between different products
 *
 * CLOSED LOOP: Scheduling may shift timings → impacts when MRP needs
 * materials → MRP may find shortages → signals back to MPS.
 */

import { Router } from 'express';
import { runScheduler } from '../engines/sched-engine.js';
import { runProductionPlan } from '../engines/prod-plan-engine.js';
import { runDRP } from '../engines/drp-engine.js';
import { buildSchedulingContext } from '../services/ai-context/scheduling-context.js';
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
} from '../services/data-provider.js';

export const schedulingRouter = Router();

/**
 * GET /api/scheduling/demo
 * Full cascade: DRP → MPS → Scheduling (per plant)
 */
schedulingRouter.get('/demo', (req, res) => {
  try {
    const periods = makePeriods(8);
    const selectedPlant = req.query.plant || 'PLANT-NORTH';
    const rule = req.query.rule || 'EDD';
    const dcCodes = getDCs().map(d => d.code);

    // Step 1: Run DRP for products made at this plant
    const plantProducts = getProductsForPlant(selectedPlant);
    const plantGrossReqs = {};

    for (const skuCode of plantProducts) {
      const locations = [];
      for (const dc of dcCodes) {
        const inv = dcInventory[dc]?.[skuCode];
        const demand = dcDemandForecast[dc]?.[skuCode];
        if (!inv || !demand) continue;
        const lane = getBestSourceForDC(dc, skuCode);
        if (!lane || lane.source !== selectedPlant) continue;

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
      const drpResult = runDRP({ skuCode, periods, locations });
      plantGrossReqs[skuCode] = drpResult.plantRequirements?.grossReqs || new Array(8).fill(0);
    }

    // Step 2: Create production orders from MPS (chase strategy = produce what's needed)
    const allOrders = [];
    let orderIdx = 1;

    for (const skuCode of plantProducts) {
      const grossReqs = plantGrossReqs[skuCode] || new Array(8).fill(0);
      const inv = plantInventory[selectedPlant]?.[skuCode] || { onHand: 0 };
      const prod = products.find(p => p.code === skuCode);
      const family = productFamilies.find(f => f.products.includes(skuCode));

      // Use chase strategy for scheduling (produce exactly what's needed)
      const plan = runProductionPlan({
        periods,
        grossReqs,
        beginningInventory: inv.onHand,
        costPerUnit: prod?.unitCost || 100,
      });

      const production = plan.strategies.chase.production;

      // Get processing time from work center data
      const wcData = (plantWorkCenters[selectedPlant] || [])[1]; // Assembly line
      const hrsPerUnit = wcData?.hoursPerUnit?.[family?.code] || 1.0;

      for (let i = 0; i < periods.length; i++) {
        if (production[i] > 0) {
          allOrders.push({
            id: `PO-${String(orderIdx++).padStart(3, '0')}`,
            skuCode,
            skuName: prod?.name,
            qty: production[i],
            processingTime: Math.round(production[i] * hrsPerUnit * 10) / 10,
            dueDate: periods[i],
            workCenter: wcData?.code || 'WC-ASSEMBLY',
            priority: 'normal',
          });
        }
      }
    }

    // Step 3: Schedule
    const result = runScheduler({
      orders: allOrders,
      rule,
      capacityHoursPerDay: 8,
      changeoverTime: 1,
      compareRules: true,
      currentDate: '2026-04-07',
    });

    res.json({
      periods,
      plant: selectedPlant,
      plantProducts,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

/**
 * POST /api/scheduling/demo/analyze — Schedule + AI stream
 */
schedulingRouter.post('/demo/analyze', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const { question, plant: reqPlant, rule: reqRule } = req.body || {};
    const selectedPlant = reqPlant || 'PLANT-NORTH';
    const rule = reqRule || 'EDD';
    const periods = makePeriods(8);
    const dcCodes = getDCs().map(d => d.code);

    // Run same DRP → MPS → Schedule cascade as /demo
    const plantProducts = getProductsForPlant(selectedPlant);
    const plantGrossReqs = {};

    for (const skuCode of plantProducts) {
      const locations = [];
      for (const dc of dcCodes) {
        const inv = dcInventory[dc]?.[skuCode];
        const demand = dcDemandForecast[dc]?.[skuCode];
        if (!inv || !demand) continue;
        const lane = getBestSourceForDC(dc, skuCode);
        if (!lane || lane.source !== selectedPlant) continue;
        locations.push({
          code: dc, onHand: inv.onHand, safetyStock: inv.safetyStock,
          scheduledReceipts: inv.scheduledReceipts || periods.map(() => 0),
          grossReqs: demand, transitLeadTime: lane.leadTimePeriods, sourceCode: lane.source,
        });
      }
      if (locations.length === 0) continue;
      const drpResult = runDRP({ skuCode, periods, locations });
      plantGrossReqs[skuCode] = drpResult.plantRequirements?.grossReqs || new Array(8).fill(0);
    }

    const allOrders = [];
    let orderIdx = 1;
    for (const skuCode of plantProducts) {
      const grossReqs = plantGrossReqs[skuCode] || new Array(8).fill(0);
      const inv = plantInventory[selectedPlant]?.[skuCode] || { onHand: 0 };
      const prod = products.find(p => p.code === skuCode);
      const family = productFamilies.find(f => f.products.includes(skuCode));
      const plan = runProductionPlan({ periods, grossReqs, beginningInventory: inv.onHand, costPerUnit: prod?.unitCost || 100 });
      const production = plan.strategies.chase.production;
      const wcData = (plantWorkCenters[selectedPlant] || [])[1];
      const hrsPerUnit = wcData?.hoursPerUnit?.[family?.code] || 1.0;
      for (let i = 0; i < periods.length; i++) {
        if (production[i] > 0) {
          allOrders.push({
            id: `PO-${String(orderIdx++).padStart(3, '0')}`, skuCode, skuName: prod?.name,
            qty: production[i], processingTime: Math.round(production[i] * hrsPerUnit * 10) / 10,
            dueDate: periods[i], workCenter: wcData?.code || 'WC-ASSEMBLY', priority: 'normal',
          });
        }
      }
    }

    const result = runScheduler({
      orders: allOrders, rule, capacityHoursPerDay: 8,
      changeoverTime: 1, compareRules: true, currentDate: '2026-04-07',
    });

    const { systemPrompt, userMessage } = buildSchedulingContext({
      scheduleResult: result, plant: selectedPlant, rule, periods, plannerQuestion: question,
    });

    // SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`event: schedule-results\ndata: ${JSON.stringify({
      plant: selectedPlant, rule, totalOrders: result.totalOrders,
      makespan: result.makespan, lateOrders: result.lateOrders,
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
 * POST /api/scheduling/run
 */
schedulingRouter.post('/run', (req, res) => {
  try {
    const { orders, rule, capacityHoursPerDay, changeoverTime, compareRules } = req.body;
    if (!orders) return res.status(400).json({ error: 'Required: orders' });
    res.json(runScheduler({
      orders,
      rule: rule || 'EDD',
      capacityHoursPerDay: capacityHoursPerDay || 8,
      changeoverTime: changeoverTime || 0,
      compareRules: compareRules || false,
    }));
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
