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
import { calculateFinancialImpact } from '../services/financial-impact.js';
import { runDRP } from '../engines/drp-engine.js';
import { runProductionPlan, roughCutCapacity } from '../engines/prod-plan-engine.js';
import { runScheduler } from '../engines/sched-engine.js';
import { runMRP } from '../engines/mrp-engine.js';
import {
  products,
  dcInventory,
  dcDemandForecast,
  plantInventory,
  plantWorkCenters,
  productFamilies,
  getProductsForPlant,
  getPlants,
  getDCs,
  getBestSourceForDC,
} from '../services/data-provider.js';
import { plantBOMs, getSkuByCode } from '../services/data-provider.js';

export const cascadeRouter = Router();

// ─── In-memory scenario store ────────────────────────────────
const savedScenarios = [];

// ─── Helper: make 8 weekly periods ─────────────────────────────

function makePeriods(count = 8) {
  const periods = [];
  const base = new Date('2026-04-07');
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    periods.push(d.toISOString().slice(0, 10));
  }
  return periods;
}

// ─── Run a full cascade scenario synchronously ─────────────────

function runScenario(demandMultiplier) {
  const periods = makePeriods(8);
  const dcCodes = getDCs().map(d => d.code);

  // ── Step 1: DRP ──────────────────────────────────────────────
  const drpResults = [];
  const plantGrossReqs = {};

  for (const product of products) {
    const sku = product.code;
    const locations = [];

    for (const dc of dcCodes) {
      const inv = dcInventory[dc]?.[sku];
      const baseDemand = dcDemandForecast[dc]?.[sku];
      if (!inv || !baseDemand) continue;
      const lane = getBestSourceForDC(dc, sku);
      if (!lane) continue;

      const scaledDemand = baseDemand.map(v => Math.round(v * demandMultiplier));

      locations.push({
        code: dc,
        onHand: inv.onHand,
        safetyStock: inv.safetyStock,
        scheduledReceipts: inv.scheduledReceipts || periods.map(() => 0),
        grossReqs: scaledDemand,
        transitLeadTime: lane.leadTimePeriods,
        sourceCode: lane.source,
      });
    }

    if (locations.length === 0) continue;
    const result = runDRP({ skuCode: sku, periods, locations });
    drpResults.push(result);

    const plantCode = result.plantRequirements?.plantCode;
    if (plantCode) {
      if (!plantGrossReqs[plantCode]) plantGrossReqs[plantCode] = {};
      plantGrossReqs[plantCode][sku] = result.plantRequirements.grossReqs;
    }
  }

  const drpExceptions = drpResults.reduce((s, r) => s + (r.exceptions?.length || 0), 0);
  const drpCritical = drpResults.reduce((s, r) => s + (r.exceptions?.filter(e => e.severity === 'critical').length || 0), 0);

  // ── Step 2: Production Plan ──────────────────────────────────
  const plantPlans = {};

  for (const plant of getPlants()) {
    const pc = plant.code;
    const productReqs = plantGrossReqs[pc] || {};
    const plantProds = getProductsForPlant(pc);
    const aggregateProduction = new Array(periods.length).fill(0);

    for (const skuCode of plantProds) {
      const grossReqs = productReqs[skuCode] || new Array(periods.length).fill(0);
      const inv = plantInventory[pc]?.[skuCode] || { onHand: 0 };
      const prod = products.find(p => p.code === skuCode);

      const plan = runProductionPlan({
        periods,
        grossReqs,
        beginningInventory: inv.onHand,
        costPerUnit: prod?.unitCost || 100,
      });

      const recommended = plan.strategies[plan.recommended];
      for (let i = 0; i < periods.length; i++) {
        aggregateProduction[i] += recommended.production[i] || 0;
      }
    }

    const rccp = roughCutCapacity({
      periods,
      production: aggregateProduction,
      workCenters: (plantWorkCenters[pc] || []).map(wc => ({
        code: wc.code,
        hoursPerUnit: 1.0,
        capacityHoursPerPeriod: wc.capacityHoursPerWeek,
      })),
    });

    plantPlans[pc] = { aggregateProduction, rccp };
  }

  const totalProductionOrders = Object.values(plantPlans).reduce(
    (s, p) => s + p.aggregateProduction.filter(v => v > 0).length, 0
  );

  // ── Step 3: Scheduling ───────────────────────────────────────
  const scheduleResults = {};

  for (const plant of getPlants()) {
    const pc = plant.code;
    const plantProds = getProductsForPlant(pc);
    const productReqs = plantGrossReqs[pc] || {};
    const allOrders = [];
    let orderIdx = 1;

    for (const skuCode of plantProds) {
      const grossReqs = productReqs[skuCode] || new Array(periods.length).fill(0);
      const inv = plantInventory[pc]?.[skuCode] || { onHand: 0 };
      const prod = products.find(p => p.code === skuCode);
      const family = productFamilies.find(f => f.products.includes(skuCode));

      const plan = runProductionPlan({
        periods,
        grossReqs,
        beginningInventory: inv.onHand,
        costPerUnit: prod?.unitCost || 100,
      });

      const production = plan.strategies.chase.production;
      const wcData = (plantWorkCenters[pc] || [])[1];
      const hrsPerUnit = wcData?.hoursPerUnit?.[family?.code] || 1.0;

      for (let i = 0; i < periods.length; i++) {
        if (production[i] > 0) {
          allOrders.push({
            id: `PO-${pc.split('-')[1]}-${String(orderIdx++).padStart(3, '0')}`,
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

    if (allOrders.length > 0) {
      scheduleResults[pc] = runScheduler({
        orders: allOrders,
        rule: 'EDD',
        capacityHoursPerDay: 8,
        changeoverTime: 1,
        compareRules: true,
        currentDate: periods[0],
      });
    }
  }

  const totalScheduledOrders = Object.values(scheduleResults).reduce(
    (s, r) => s + (r.scheduled?.length || 0), 0
  );
  const totalMakespan = Object.values(scheduleResults).reduce(
    (s, r) => s + (r.makespan || 0), 0
  );
  const totalLateOrders = Object.values(scheduleResults).reduce(
    (s, r) => s + (r.scheduled?.filter(o => o.late).length || 0), 0
  );

  // ── Step 4: MRP ──────────────────────────────────────────────
  const mrpResults = {};

  for (const plant of getPlants()) {
    const pc = plant.code;
    const plantBOM = plantBOMs[pc] || {};
    const plantProds = getProductsForPlant(pc);
    const productReqs = plantGrossReqs[pc] || {};
    const results = [];
    const dependentDemand = {};

    // Phase 1: Finished goods (Level 0)
    for (const fgCode of plantProds) {
      const fg = getSkuByCode(fgCode);
      if (!fg) continue;
      const grossReqs = productReqs[fgCode] || new Array(periods.length).fill(0);
      const inv = plantInventory[pc]?.[fgCode] || { onHand: 0, safetyStock: 0 };

      const result = runMRP({
        sku: { id: fgCode, code: fgCode },
        periods,
        grossReqs,
        scheduledReceipts: new Array(periods.length).fill(0),
        onHand: inv.onHand || fg.onHand,
        safetyStock: inv.safetyStock || fg.safetyStock,
        leadTimePeriods: fg.leadTimePeriods,
        lotSizing: fg.lotSizing,
      });

      results.push({ sku: { code: fgCode, name: fg.name, level: 0 }, plantCode: pc, ...result });

      const children = plantBOM[fgCode];
      if (!children) continue;
      for (const child of children) {
        if (!dependentDemand[child.childCode]) {
          dependentDemand[child.childCode] = new Array(periods.length).fill(0);
        }
        const scrapFactor = child.scrapPct > 0 ? 1 / (1 - child.scrapPct / 100) : 1;
        for (let t = 0; t < periods.length; t++) {
          dependentDemand[child.childCode][t] += result.records[t].plannedOrderRelease * child.qtyPer * scrapFactor;
        }
      }
    }

    // Phase 2: Subassemblies (Level 1)
    const level1Codes = [...new Set(
      Object.values(plantBOM).flat().map(c => c.childCode).filter(code => {
        const sku = getSkuByCode(code);
        return sku && sku.level === 1;
      })
    )];

    for (const subCode of level1Codes) {
      const sub = getSkuByCode(subCode);
      if (!sub) continue;
      const grossReqs = dependentDemand[subCode] || new Array(periods.length).fill(0);

      const result = runMRP({
        sku: { id: subCode, code: subCode },
        periods,
        grossReqs,
        scheduledReceipts: new Array(periods.length).fill(0),
        onHand: sub.onHand,
        safetyStock: sub.safetyStock,
        leadTimePeriods: sub.leadTimePeriods,
        lotSizing: sub.lotSizing,
      });

      results.push({ sku: { code: subCode, name: sub.name, level: 1 }, plantCode: pc, ...result });

      const children = plantBOM[subCode];
      if (!children) continue;
      for (const child of children) {
        if (!dependentDemand[child.childCode]) {
          dependentDemand[child.childCode] = new Array(periods.length).fill(0);
        }
        const scrapFactor = child.scrapPct > 0 ? 1 / (1 - child.scrapPct / 100) : 1;
        for (let t = 0; t < periods.length; t++) {
          dependentDemand[child.childCode][t] += result.records[t].plannedOrderRelease * child.qtyPer * scrapFactor;
        }
      }
    }

    // Phase 3: Raw materials (Level 2)
    const level2Codes = [...new Set(
      Object.keys(dependentDemand).filter(code => {
        const sku = getSkuByCode(code);
        return sku && sku.level === 2;
      })
    )];

    for (const rawCode of level2Codes) {
      const raw = getSkuByCode(rawCode);
      if (!raw) continue;
      const grossReqs = dependentDemand[rawCode] || new Array(periods.length).fill(0);

      const result = runMRP({
        sku: { id: rawCode, code: rawCode },
        periods,
        grossReqs,
        scheduledReceipts: new Array(periods.length).fill(0),
        onHand: raw.onHand,
        safetyStock: raw.safetyStock,
        leadTimePeriods: raw.leadTimePeriods,
        lotSizing: raw.lotSizing,
      });

      results.push({ sku: { code: rawCode, name: raw.name, level: 2 }, plantCode: pc, ...result });
    }

    mrpResults[pc] = {
      results,
      totalExceptions: results.reduce((s, r) => s + r.exceptions.length, 0),
      criticalExceptions: results.reduce((s, r) => s + r.exceptions.filter(e => e.severity === 'critical').length, 0),
    };
  }

  const totalMrpExceptions = Object.values(mrpResults).reduce((s, r) => s + r.totalExceptions, 0);
  const totalMrpCritical = Object.values(mrpResults).reduce((s, r) => s + r.criticalExceptions, 0);

  return {
    drp: {
      skusPlanned: drpResults.length,
      exceptions: drpExceptions,
      critical: drpCritical,
    },
    production: {
      orders: totalProductionOrders,
    },
    scheduling: {
      orders: totalScheduledOrders,
      makespan: totalMakespan,
      lateOrders: totalLateOrders,
    },
    mrp: {
      totalExceptions: totalMrpExceptions,
      critical: totalMrpCritical,
    },
  };
}

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

// Run a what-if scenario (synchronous JSON response)
cascadeRouter.post('/scenario', (req, res) => {
  try {
    const { demandMultiplier = 1.0, label = 'Scenario' } = req.body || {};
    const results = runScenario(demandMultiplier);
    const financialImpact = calculateFinancialImpact(results);
    res.json({
      id: Date.now(),
      label,
      multiplier: demandMultiplier,
      ...results,
      financialImpact,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cascade/scenarios — return last 10 saved scenarios
cascadeRouter.get('/scenarios', (req, res) => {
  res.json({ scenarios: savedScenarios.slice(-10) });
});

// POST /api/cascade/scenarios/save — save a labeled scenario
cascadeRouter.post('/scenarios/save', (req, res) => {
  try {
    const { demandMultiplier = 1.0, label = 'Scenario', scenarios: comparisonResults } = req.body || {};
    const results = runScenario(demandMultiplier);
    const financialImpact = calculateFinancialImpact(results);
    const scenario = {
      id: Date.now(),
      label,
      demandMultiplier,
      multiplier: demandMultiplier,
      savedAt: new Date().toISOString(),
      financialImpact,
      // Store the full comparison results array so we can restore the table
      scenarios: comparisonResults || null,
    };
    savedScenarios.push(scenario);
    // Keep only the last 50 to avoid unbounded growth
    if (savedScenarios.length > 50) savedScenarios.splice(0, savedScenarios.length - 50);
    res.json(scenario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset circuit breaker
cascadeRouter.post('/reset', (req, res) => {
  cascade.resetCircuitBreaker();
  res.json({ status: 'ok', message: 'Circuit breaker reset' });
});
