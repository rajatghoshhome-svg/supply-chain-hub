/**
 * General AI Chat Service
 *
 * Provides module-aware AI chat using Claude API.
 * Each module gets a rich system prompt with ASCM context + live engine data.
 * Module-specific analyze endpoints (SSE) are on each route;
 * this service handles the general conversational chat.
 */

import { runDRP } from '../engines/drp-engine.js';
import { runProductionPlan, roughCutCapacity } from '../engines/prod-plan-engine.js';
import { runScheduler } from '../engines/sched-engine.js';
import { runMRP } from '../engines/mrp-engine.js';
import { bestFit } from '../engines/demand-engine.js';
import { demandHistory } from '../data/synthetic-demand.js';
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
} from '../data/synthetic-network.js';
import { plantBOMs, getSkuByCode } from '../data/synthetic-bom.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

function buildPreamble() {
  return `You are an AI supply chain planning assistant embedded in an ASCM/APICS-compliant Manufacturing Planning and Control (MPC) platform.

You serve small and mid-size manufacturers ($50M-$500M revenue) running electric motor production across 3 plants, 3 DCs, and 11 products.

ASCM MPC CASCADE:
  Demand Plan → DRP → S&OP/Production Plan → MPS (RCCP) → [MRP + Scheduling ⟲]

KEY PRINCIPLES:
- DRP assigns demand to plants; MRP explodes plant-specific BOMs
- MPS does rough-cut capacity planning; Scheduling creates Gantt-level sequences
- Closed loop: Scheduling timing shifts → MRP material needs adjust → signals back to MPS
- MTR-200 is dual-sourced: PLANT-NORTH (ROT-A standard rotor) and PLANT-SOUTH (ROT-B heavy-duty)

Be concise and data-driven. Cite specific SKU codes, plants, periods, and quantities.
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

function buildModuleContext(module) {
  const plants = getPlants();
  const dcs = getDCs();
  const live = getLiveData();

  let liveSection = '';
  if (live) {
    liveSection = `\n\n## LIVE ENGINE DATA (current state)\n`;
    liveSection += `Planning Horizon: ${live.periods?.[0]} to ${live.periods?.[live.periods.length - 1]} (8 weekly periods)\n`;
    liveSection += `DRP: ${live.drpResults} SKUs planned, ${live.drpExceptions} exceptions\n`;

    if (live.demandSnapshots?.length > 0) {
      liveSection += `\nDemand Forecasts:\n`;
      for (const d of live.demandSnapshots) {
        liveSection += `  ${d.sku}: best method=${d.method}, MAPE=${d.mape}%, next 4 periods=[${d.forecast.join(', ')}]\n`;
      }
    }

    liveSection += `\nProduction Planning:\n`;
    for (const [pc, s] of Object.entries(live.prodSummaries || {})) {
      liveSection += `  ${pc}: total demand=${s.totalDemand} units, recommended strategy=${s.recommended}\n`;
    }

    liveSection += `\nScheduling (EDD rule):\n`;
    for (const [pc, s] of Object.entries(live.schedSummaries || {})) {
      liveSection += `  ${pc}: ${s.totalOrders} orders, makespan=${s.makespan}h, ${s.lateOrders} late\n`;
    }

    liveSection += `\nMRP Summary:\n`;
    for (const [pc, s] of Object.entries(live.mrpSummaries || {})) {
      liveSection += `  ${pc}: ${s.totalExceptions} exceptions (${s.critical} critical)`;
      if (s.topShortages?.length > 0) {
        liveSection += `, shortages: ${s.topShortages.map(sh => `${sh.sku} period ${sh.period} (${Math.round(sh.qty)} units)`).join(', ')}`;
      }
      liveSection += `\n`;
    }
  }

  switch (module) {
    case 'drp': {
      const lines = ['\n## DRP Context'];
      lines.push(`Network: ${plants.length} plants, ${dcs.length} DCs, ${products.length} products`);
      lines.push(`Plants: ${plants.map(p => `${p.code} (${p.city})`).join(', ')}`);
      lines.push(`DCs: ${dcs.map(d => `${d.code} (${d.city})`).join(', ')}`);
      lines.push(`Lanes: ${networkLanes.filter(l => l.laneType === 'outbound').map(l => `${l.source}→${l.dest} (${l.leadTimePeriods}wk)`).join(', ')}`);
      return lines.join('\n') + liveSection;
    }
    case 'demand': {
      let ctx = `\n## Demand Planning Context\n${products.length} products tracked: ${products.map(p => `${p.code} (${p.name})`).join(', ')}\nFamilies: ${productFamilies.map(f => `${f.code} (${f.products.join(', ')})`).join('; ')}`;
      return ctx + liveSection;
    }
    case 'production_plan': {
      const lines = ['\n## Production Planning Context'];
      for (const plant of plants) {
        const wcs = plantWorkCenters[plant.code] || [];
        lines.push(`${plant.code} (${plant.city}): capacity ${plant.weeklyCapacity} units/week, ${wcs.length} work centers`);
        lines.push(`  Products: ${getProductsForPlant(plant.code).join(', ')}`);
      }
      return lines.join('\n') + liveSection;
    }
    case 'scheduling': {
      const lines = ['\n## Scheduling Context'];
      lines.push('Rules available: SPT (shortest processing time), EDD (earliest due date), CR (critical ratio)');
      for (const plant of plants) {
        const wcs = plantWorkCenters[plant.code] || [];
        lines.push(`${plant.code}: ${wcs.map(w => `${w.code} (${w.name}, ${w.capacityHoursPerWeek}h/wk)`).join(', ')}`);
      }
      return lines.join('\n') + liveSection;
    }
    case 'mrp': {
      const lines = ['\n## MRP Context'];
      lines.push('Plant-specific BOMs — same FG may have different component structure per plant');
      for (const plant of plants) {
        const bom = plantBOMs[plant.code] || {};
        const fgs = Object.keys(bom);
        lines.push(`${plant.code}: ${fgs.length} FG BOMs defined (${fgs.join(', ')})`);
      }
      lines.push('\nDual-sourced: MTR-200 uses ROT-A at PLANT-NORTH, ROT-B at PLANT-SOUTH');
      return lines.join('\n') + liveSection;
    }
    default: {
      const lines = ['\n## Network Overview'];
      lines.push(`${plants.length} plants, ${dcs.length} DCs, ${products.length} products, ${productFamilies.length} families`);
      lines.push(`Plants: ${plants.map(p => `${p.code} (${p.city}, cap ${p.weeklyCapacity}/wk)`).join('; ')}`);
      lines.push(`DCs: ${dcs.map(d => `${d.code} (${d.city})`).join('; ')}`);
      lines.push(`Products: ${products.map(p => p.code).join(', ')}`);
      return lines.join('\n') + liveSection;
    }
  }
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
