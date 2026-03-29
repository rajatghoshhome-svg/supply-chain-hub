/**
 * General AI Chat Service
 *
 * Provides module-aware AI chat using Claude API.
 * Each module gets a rich system prompt with ASCM context + live engine data.
 * Module-specific analyze endpoints (SSE) are on each route;
 * this service handles the general conversational chat.
 *
 * Context building is delegated to per-module builders in ./ai-context/.
 * This file retains the 60s cache and the engine-running logic;
 * each context builder receives the cached liveData snapshot and
 * returns { systemPromptSection, dataSnapshot }.
 */

import { runDRP } from '../engines/drp-engine.js';
import { runProductionPlan, roughCutCapacity } from '../engines/prod-plan-engine.js';
import { runScheduler } from '../engines/sched-engine.js';
import { runMRP } from '../engines/mrp-engine.js';
import { bestFit } from '../engines/demand-engine.js';
import { demandHistory } from './data-provider.js';
import {
  products,
  dcInventory,
  dcDemandForecast,
  plantInventory,
  plantWorkCenters,
  networkLocations,
  networkLanes,
  getBestSourceForDC,
  getDCs,
  getPlants,
  getProductsForPlant,
  productFamilies,
} from './data-provider.js';
import { plantBOMs, getSkuByCode } from './data-provider.js';

// Champion Pet Foods data store
import {
  getStoreSummary,
  getSkuIdsForLevel,
  getHistory,
  getStatForecast,
  getAccuracyMetrics,
  isInitialized as isChampionInitialized,
} from '../data/champion-store.js';
import {
  brands as championBrands,
  families as championFamilies,
  lines as championLines,
  products as championProducts,
  skus as championSkus,
} from '../data/champion-catalog.js';

// Per-module context builders
import { buildDemandChatContext } from './ai-context/demand-context.js';
import { buildDRPChatContext } from './ai-context/drp-context.js';
import { buildMRPChatContext } from './ai-context/mrp-context.js';
import { buildProductionChatContext } from './ai-context/production-context.js';
import { buildSchedulingChatContext } from './ai-context/scheduling-context.js';
import { buildBriefingChatContext } from './ai-context/briefing.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

function buildPreamble() {
  // Pull live store summary if Champion store is initialized
  let storeLine = '';
  if (isChampionInitialized()) {
    const summary = getStoreSummary();
    storeLine = `\nCOMPANY DATA: Champion Pet Foods — ${summary.brands} brands, ${summary.families} families, ${summary.lines} lines, ${summary.products} products, ${summary.skus} SKUs across ${summary.customers} customers. ${summary.plants} plants, ${summary.dcs} DCs. ${summary.totalForecasts} active forecasts (${summary.totalOverrides} overrides).`;
  }

  return `You are an AI supply chain planning assistant embedded in an ASCM/APICS-compliant planning platform for Champion Pet Foods.

Champion Pet Foods is a premium pet nutrition company with two flagship brands:
  - ORIJEN: Biologically Appropriate, premium-tier dog and cat food (dry, freeze-dried, treats)
  - ACANA: Heritage-class, high-quality dog and cat food (dry, wet)

PRODUCT HIERARCHY: Brand → Family → Line → Product → SKU (size variant)
  Example: ORIJEN → Dry Dog Food → Core → Original → ORI-ORIG-25 (25 lb bag)
${storeLine}

ASCM MPC CASCADE:
  Demand Plan → DRP → S&OP/Production Plan → MPS (RCCP) → [MRP + Scheduling ⟲]

KEY PRINCIPLES:
- Weekly planning buckets with 104-week history and 52-week forecast horizon
- DRP assigns demand to plants; MRP explodes plant-specific BOMs
- MPS does rough-cut capacity planning; Scheduling creates Gantt-level sequences
- Forecasts are generated per SKU × customer combination, aggregatable at any hierarchy level
- Top movers include ORIJEN Original, ACANA Wild Prairie, ORIJEN Amazing Grains Original

Be concise and data-driven. Cite specific product names, SKU IDs, hierarchy levels, and quantities.
Format responses with markdown for readability.
When recommending actions, include specific numbers and rationale.
NEVER fabricate data — only reference what's in the context provided.`;
}

// Cache live data for 60s to avoid re-running engines on every chat message
let _liveDataCache = null;
let _cacheTime = 0;
const CACHE_TTL = 60000;

function getLiveData() {
  const now = Date.now();
  if (_liveDataCache && (now - _cacheTime) < CACHE_TTL) return _liveDataCache;

  try {
    // Run DRP
    const periods = [];
    const base = new Date('2026-04-07');
    for (let i = 0; i < 8; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i * 7);
      periods.push(d.toISOString().slice(0, 10));
    }

    const dcCodes = getDCs().map(d => d.code);
    const drpResults = [];
    const plantGrossReqs = {};
    let drpExceptions = 0;

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
      const result = runDRP({ skuCode: sku, periods, locations });
      drpResults.push(result);
      drpExceptions += result.exceptions?.length || 0;
      const plantCode = result.plantRequirements?.plantCode;
      if (plantCode) {
        if (!plantGrossReqs[plantCode]) plantGrossReqs[plantCode] = {};
        plantGrossReqs[plantCode][sku] = result.plantRequirements.grossReqs;
      }
    }

    // Run Demand Forecast for top SKUs
    const demandSnapshots = [];
    for (const sku of ['MTR-100', 'MTR-200', 'MTR-500']) {
      try {
        const history = demandHistory[sku];
        if (history?.length > 0) {
          const result = bestFit(history);
          demandSnapshots.push({
            sku, method: result.method, mape: Math.round(result.mape * 10) / 10,
            forecast: result.forecast.slice(0, 4),
          });
        }
      } catch { /* skip */ }
    }

    // Run Production Plan summary
    const prodSummaries = {};
    for (const plant of getPlants()) {
      const pc = plant.code;
      const plantProds = getProductsForPlant(pc);
      const productReqs = plantGrossReqs[pc] || {};
      let totalProd = 0, recommended = 'chase';
      for (const skuCode of plantProds) {
        const grossReqs = productReqs[skuCode] || new Array(periods.length).fill(0);
        const inv = plantInventory[pc]?.[skuCode] || { onHand: 0 };
        const prod = products.find(p => p.code === skuCode);
        try {
          const plan = runProductionPlan({
            periods, grossReqs, beginningInventory: inv.onHand, costPerUnit: prod?.unitCost || 100,
          });
          recommended = plan.recommended;
          totalProd += grossReqs.reduce((s, v) => s + v, 0);
        } catch { /* skip */ }
      }
      prodSummaries[pc] = { totalDemand: totalProd, recommended };
    }

    // Run Scheduling summary
    const schedSummaries = {};
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
        try {
          const plan = runProductionPlan({
            periods, grossReqs, beginningInventory: inv.onHand, costPerUnit: prod?.unitCost || 100,
          });
          const production = plan.strategies.chase.production;
          const wcData = (plantWorkCenters[pc] || [])[1];
          const hrsPerUnit = wcData?.hoursPerUnit?.[family?.code] || 1.0;
          for (let i = 0; i < periods.length; i++) {
            if (production[i] > 0) {
              allOrders.push({
                id: `PO-${pc.split('-')[1]}-${String(orderIdx++).padStart(3, '0')}`,
                skuCode, qty: production[i],
                processingTime: Math.round(production[i] * hrsPerUnit * 10) / 10,
                dueDate: periods[i], workCenter: wcData?.code || 'WC-ASSEMBLY',
              });
            }
          }
        } catch { /* skip */ }
      }
      if (allOrders.length > 0) {
        try {
          const sched = runScheduler({
            orders: allOrders, rule: 'EDD', capacityHoursPerDay: 8,
            changeoverTime: 1, compareRules: true, currentDate: periods[0],
          });
          schedSummaries[pc] = {
            totalOrders: sched.totalOrders,
            makespan: Math.round(sched.makespan * 10) / 10,
            lateOrders: sched.lateOrders,
          };
        } catch { /* skip */ }
      }
    }

    // Run MRP summary per plant
    const mrpSummaries = {};
    for (const plant of getPlants()) {
      const pc = plant.code;
      const plantBOM = plantBOMs[pc] || {};
      const plantProds = getProductsForPlant(pc);
      const productReqs = plantGrossReqs[pc] || {};
      let totalExc = 0, criticalExc = 0, shortages = [];
      const dependentDemand = {};

      for (const fgCode of plantProds) {
        const fg = getSkuByCode(fgCode);
        if (!fg) continue;
        const grossReqs = productReqs[fgCode] || new Array(periods.length).fill(0);
        const inv = plantInventory[pc]?.[fgCode] || { onHand: 0, safetyStock: 0 };
        try {
          const result = runMRP({
            sku: { id: fgCode, code: fgCode }, periods, grossReqs,
            scheduledReceipts: new Array(periods.length).fill(0),
            onHand: inv.onHand || fg.onHand, safetyStock: inv.safetyStock || fg.safetyStock,
            leadTimePeriods: fg.leadTimePeriods, lotSizing: fg.lotSizing,
          });
          totalExc += result.exceptions.length;
          criticalExc += result.exceptions.filter(e => e.severity === 'critical').length;
          const shortage = result.records.find(r => r.projectedOH < 0);
          if (shortage) shortages.push({ sku: fgCode, period: shortage.period, qty: Math.abs(shortage.projectedOH) });

          // Explode for dependent demand
          const children = plantBOM[fgCode];
          if (children) {
            for (const child of children) {
              if (!dependentDemand[child.childCode]) dependentDemand[child.childCode] = new Array(periods.length).fill(0);
              const sf = child.scrapPct > 0 ? 1 / (1 - child.scrapPct / 100) : 1;
              for (let t = 0; t < periods.length; t++) dependentDemand[child.childCode][t] += result.records[t].plannedOrderRelease * child.qtyPer * sf;
            }
          }
        } catch { /* skip */ }
      }
      mrpSummaries[pc] = { totalExceptions: totalExc, critical: criticalExc, topShortages: shortages.slice(0, 3) };
    }

    _liveDataCache = { drpResults: drpResults.length, drpExceptions, demandSnapshots, prodSummaries, schedSummaries, mrpSummaries, periods };
    _cacheTime = now;
    return _liveDataCache;
  } catch (e) {
    console.warn('[AI] Failed to generate live data:', e.message);
    return null;
  }
}

/**
 * Dispatch to per-module context builders.
 * Each builder returns { systemPromptSection, dataSnapshot }.
 * We extract systemPromptSection for the system prompt.
 * Falls back to the briefing (general) context for unknown modules.
 */
function buildModuleContext(module) {
  const plants = getPlants();
  const dcs = getDCs();
  const liveData = getLiveData();

  // Common params shared across builders
  const common = { plants, dcs, products, productFamilies, liveData };

  const builders = {
    demand: () => buildDemandChatContext({
      products, productFamilies, liveData,
      championStore: isChampionInitialized() ? {
        summary: getStoreSummary(),
        brands: championBrands,
        families: championFamilies,
        lines: championLines,
        products: championProducts,
        skus: championSkus,
        getAccuracyMetrics,
        getSkuIdsForLevel,
      } : null,
    }),
    drp: () => buildDRPChatContext({
      plants, dcs, products, networkLanes, liveData,
    }),
    mrp: () => buildMRPChatContext({
      plants, plantBOMs, getProductsForPlant, liveData,
    }),
    production_plan: () => buildProductionChatContext({
      plants, plantWorkCenters, getProductsForPlant, liveData,
    }),
    scheduling: () => buildSchedulingChatContext({
      plants, plantWorkCenters, liveData,
    }),
    briefing: () => buildBriefingChatContext(common),
  };

  const builder = builders[module] || builders.briefing;
  const { systemPromptSection } = builder();
  return systemPromptSection;
}

export async function streamChat({ module, messages, res }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const systemPrompt = buildPreamble() + buildModuleContext(module);

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
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  // Stream SSE back to client
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }
  } finally {
    res.end();
  }
}
