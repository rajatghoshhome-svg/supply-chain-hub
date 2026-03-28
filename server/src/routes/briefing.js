/**
 * Morning Briefing API
 *
 * Runs all 5 ASCM engines with synthetic data, aggregates KPIs,
 * and returns a structured JSON summary for the morning briefing dashboard.
 */

import { Router } from 'express';
import { runDRP } from '../engines/drp-engine.js';
import { runProductionPlan, roughCutCapacity } from '../engines/prod-plan-engine.js';
import { runScheduler } from '../engines/sched-engine.js';
import { runMRP } from '../engines/mrp-engine.js';
import { bestFit } from '../engines/demand-engine.js';
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
  networkLocations,
  networkLanes,
} from '../services/data-provider.js';
import { plantBOMs, getSkuByCode } from '../services/data-provider.js';
import { demandHistory } from '../services/data-provider.js';

export const briefingRouter = Router();

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

// ─── GET /api/briefing/summary ─────────────────────────────────

briefingRouter.get('/summary', async (req, res) => {
  try {
    const periods = makePeriods(8);
    const dcCodes = getDCs().map(d => d.code);
    const attentionItems = [];

    // ── 1. Demand ──────────────────────────────────────────────
    const demandResults = {};
    let totalForecast = 0;
    let mapeSum = 0;
    let mapeCount = 0;
    let topSkuDemand = 0;
    let topSku = '';

    for (const product of products) {
      const hist = demandHistory[product.code];
      if (!hist) continue;
      try {
        const result = bestFit({ history: hist.weekly, periods: 8, seasonLength: 12 });
        demandResults[product.code] = result;
        const skuTotal = result.forecast.reduce((s, v) => s + v, 0);
        totalForecast += skuTotal;
        if (result.metrics.mape > 0) {
          mapeSum += result.metrics.mape;
          mapeCount++;
        }
        if (skuTotal > topSkuDemand) {
          topSkuDemand = skuTotal;
          topSku = product.code;
        }
      } catch { /* skip SKUs with insufficient data */ }
    }

    const avgMape = mapeCount > 0 ? Math.round((mapeSum / mapeCount) * 100) / 100 : 0;

    // ── 2. DRP ─────────────────────────────────────────────────
    const drpResults = [];
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
      const result = runDRP({ skuCode: sku, periods, locations });
      drpResults.push(result);

      const plantCode = result.plantRequirements?.plantCode;
      if (plantCode) {
        if (!plantGrossReqs[plantCode]) plantGrossReqs[plantCode] = {};
        plantGrossReqs[plantCode][sku] = result.plantRequirements.grossReqs;
      }
    }

    const drpExceptions = drpResults.reduce((s, r) => s + (r.exceptions?.length || 0), 0);
    const drpCritical = drpResults.reduce(
      (s, r) => s + (r.exceptions?.filter(e => e.severity === 'critical')?.length || 0), 0
    );

    if (drpCritical > 0) {
      attentionItems.push({
        severity: 'critical',
        module: 'DRP',
        message: `${drpCritical} critical DRP exception${drpCritical > 1 ? 's' : ''} — potential stockouts at distribution centers`,
        financialImpact: `$${(drpCritical * 800).toLocaleString()} expedite cost`,
      });
    }
    if (drpExceptions - drpCritical > 0) {
      attentionItems.push({
        severity: 'warning',
        module: 'DRP',
        message: `${drpExceptions - drpCritical} DRP warning${drpExceptions - drpCritical > 1 ? 's' : ''} — safety stock violations or expedite needed`,
        financialImpact: `$${((drpExceptions - drpCritical) * 200).toLocaleString()} expedite cost`,
      });
    }

    // ── 3. Production Plan ─────────────────────────────────────
    const plantPlans = {};
    const recommendedStrategies = {};

    for (const plant of getPlants()) {
      const pc = plant.code;
      const productReqs = plantGrossReqs[pc] || {};
      const plantProds = getProductsForPlant(pc);
      const aggregateProduction = new Array(periods.length).fill(0);
      let bestStrategy = null;
      let lowestCost = Infinity;

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

        if (plan.strategies[plan.recommended].totalCost < lowestCost) {
          lowestCost = plan.strategies[plan.recommended].totalCost;
          bestStrategy = plan.recommended;
        }
      }

      // RCCP
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
      recommendedStrategies[pc] = bestStrategy || 'chase';

      // Check for capacity overloads
      const overloaded = rccp.workCenters?.filter(wc =>
        wc.periods?.some(p => p.utilization > 100)
      ) || [];
      if (overloaded.length > 0) {
        attentionItems.push({
          severity: 'warning',
          module: 'Production',
          message: `${pc}: ${overloaded.length} work center${overloaded.length > 1 ? 's' : ''} over capacity — RCCP flags overload`,
          financialImpact: `$${(overloaded.length * 600).toLocaleString()} overtime risk`,
        });
      }
    }

    // ── 4. Scheduling ──────────────────────────────────────────
    const scheduleResults = {};
    let totalOrders = 0;
    let totalMakespan = 0;
    let totalLateOrders = 0;
    let plantCount = 0;

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
        const wcData = (plantWorkCenters[pc] || [])[1]; // Assembly line
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
        const result = runScheduler({
          orders: allOrders,
          rule: 'EDD',
          capacityHoursPerDay: 8,
          changeoverTime: 1,
          compareRules: true,
          currentDate: periods[0],
        });
        scheduleResults[pc] = result;
        totalOrders += allOrders.length;
        totalMakespan += result.makespan || 0;
        totalLateOrders += result.lateOrders || 0;
        plantCount++;
      }
    }

    const avgMakespan = plantCount > 0 ? Math.round((totalMakespan / plantCount) * 10) / 10 : 0;

    if (totalLateOrders > 0) {
      attentionItems.push({
        severity: totalLateOrders > 5 ? 'critical' : 'warning',
        module: 'Scheduling',
        message: `${totalLateOrders} late order${totalLateOrders > 1 ? 's' : ''} across ${plantCount} plant${plantCount > 1 ? 's' : ''} — review scheduling rules`,
        financialImpact: `$${(totalLateOrders * 1200).toLocaleString()} overtime risk`,
      });
    }

    // ── 5. MRP ─────────────────────────────────────────────────
    const mrpResults = {};
    let totalMrpExceptions = 0;
    let totalMrpCritical = 0;
    const topShortages = [];

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

      const plantExceptions = results.reduce((s, r) => s + r.exceptions.length, 0);
      const plantCritical = results.reduce((s, r) => s + r.exceptions.filter(e => e.severity === 'critical').length, 0);

      mrpResults[pc] = { results, totalExceptions: plantExceptions, criticalExceptions: plantCritical };
      totalMrpExceptions += plantExceptions;
      totalMrpCritical += plantCritical;

      // Collect top shortages (critical exceptions for raw materials)
      for (const r of results) {
        for (const exc of r.exceptions) {
          if (exc.severity === 'critical' && r.sku.level === 2) {
            topShortages.push({
              sku: r.sku.code,
              name: r.sku.name,
              plant: pc,
              message: exc.message,
            });
          }
        }
      }
    }

    if (totalMrpCritical > 0) {
      attentionItems.push({
        severity: 'critical',
        module: 'MRP',
        message: `${totalMrpCritical} critical MRP exception${totalMrpCritical > 1 ? 's' : ''} — material shortages may halt production`,
        financialImpact: `$${(totalMrpCritical * 2500).toLocaleString()} stockout risk`,
      });
    }
    if (totalMrpExceptions - totalMrpCritical > 0) {
      attentionItems.push({
        severity: 'warning',
        module: 'MRP',
        message: `${totalMrpExceptions - totalMrpCritical} MRP warning${totalMrpExceptions - totalMrpCritical > 1 ? 's' : ''} — review planned order timing and lot sizes`,
      });
    }

    // ── 6. Financial Impact ──────────────────────────────────────
    const financialImpact = {
      expediteCosts: 0,
      stockoutRisk: 0,
      inventoryCarrying: 0,
      overtimeCosts: 0,
      total: 0,
    };

    // Expedite costs: $800 per critical DRP exception, $200 per warning
    financialImpact.expediteCosts = drpCritical * 800 + (drpExceptions - drpCritical) * 200;

    // Stockout risk: $2,500 per critical MRP shortage
    financialImpact.stockoutRisk = totalMrpCritical * 2500;

    // Inventory carrying: estimate based on total forecast × $12 unit cost × 2% weekly
    financialImpact.inventoryCarrying = Math.round(totalForecast * 12 * 0.02);

    // Overtime: $1,200 per late order
    financialImpact.overtimeCosts = totalLateOrders * 1200;

    financialImpact.total = financialImpact.expediteCosts + financialImpact.stockoutRisk + financialImpact.inventoryCarrying + financialImpact.overtimeCosts;

    // ── Assemble response ──────────────────────────────────────

    const suppliers = networkLocations.filter(l => l.type === 'supplier');
    const plants = networkLocations.filter(l => l.type === 'plant');
    const dcs = networkLocations.filter(l => l.type === 'dc');

    // Sort attention items: critical first
    attentionItems.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));

    res.json({
      generatedAt: new Date().toISOString(),
      networkHealth: {
        suppliers: suppliers.length,
        plants: plants.length,
        dcs: dcs.length,
        products: products.length,
        lanes: networkLanes.length,
      },
      demandSnapshot: {
        totalForecast: Math.round(totalForecast),
        topSku,
        avgMape,
      },
      drpSnapshot: {
        skusPlanned: drpResults.length,
        exceptions: drpExceptions,
        critical: drpCritical,
      },
      productionSnapshot: {
        plantsActive: getPlants().length,
        recommendedStrategies,
      },
      schedulingSnapshot: {
        totalOrders,
        avgMakespan,
        totalLateOrders,
      },
      mrpSnapshot: {
        totalExceptions: totalMrpExceptions,
        critical: totalMrpCritical,
        topShortages: topShortages.slice(0, 5),
      },
      financialImpact,
      attentionItems,
    });
  } catch (err) {
    console.error('Briefing summary error:', err);
    res.status(500).json({ error: 'Failed to generate briefing summary', detail: err.message });
  }
});
