/**
 * MRP Route — Material Requirements Planning
 *
 * ASCM cascade: Demand → DRP → S&OP → MPS (RCCP) → [MRP + Scheduling ⟲]
 *
 * MRP is LAST in the cascade because:
 *   1. BOM is plant-specific (different plants have different BOMs for same FG)
 *   2. DRP must first assign demand to specific plants
 *   3. MPS must validate capacity before MRP explodes materials
 *
 * CLOSED LOOP: Scheduling shifts production timing → MRP adjusts material
 * needs → if materials unavailable → signals back to MPS for rescheduling.
 *
 * Endpoints:
 *   GET  /api/mrp/demo          — Run MRP with synthetic data (plant-specific BOM)
 *   GET  /api/mrp/demo/:plant   — Run MRP for a specific plant
 *   POST /api/mrp/demo/analyze  — Run MRP + stream AI exception analysis via SSE
 *   POST /api/mrp/run           — Run MRP with custom data
 */

import { Router } from 'express';
import { runMRP, explodeBOM } from '../engines/mrp-engine.js';
import { buildMRPContext, formatMRPSummary } from '../services/ai-context/mrp-context.js';
import { skuMaster, bomTree, plantBOMs, generateDemandForecast, getSkuByCode } from '../data/synthetic-bom.js';
import { getProductsForPlant, getPlants, plantInventory } from '../data/synthetic-network.js';

export const mrpRouter = Router();

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

// ─── Plant-Specific MRP Run ─────────────────────────────────────

/**
 * Run MRP for a specific plant using that plant's BOM.
 * This is the ASCM-correct approach: MRP runs at the plant level.
 */
function runPlantMRP(plantCode, demandOverrides) {
  const forecast = generateDemandForecast();
  const { periods } = forecast;
  const plantBOM = plantBOMs[plantCode] || {};
  const plantProducts = getProductsForPlant(plantCode);
  const plantInv = plantInventory[plantCode] || {};

  const fgDemand = demandOverrides?.finishedGoods || forecast.finishedGoods;
  const schedReceipts = demandOverrides?.scheduledReceipts || {};

  const mrpResults = [];
  const dependentDemand = {};

  // Phase 1: Finished goods (Level 0) — only products this plant makes
  for (const fgCode of plantProducts) {
    const fg = getSkuByCode(fgCode);
    if (!fg) continue;

    const grossReqs = fgDemand[fgCode] || new Array(periods.length).fill(0);
    const sr = schedReceipts[fgCode] || new Array(periods.length).fill(0);
    const inv = plantInv[fgCode] || { onHand: 0, safetyStock: 0 };

    const result = runMRP({
      sku: { id: fgCode, code: fgCode },
      periods,
      grossReqs,
      scheduledReceipts: sr,
      onHand: inv.onHand || fg.onHand,
      safetyStock: inv.safetyStock || fg.safetyStock,
      leadTimePeriods: fg.leadTimePeriods,
      lotSizing: fg.lotSizing,
    });

    mrpResults.push({
      sku: { code: fgCode, name: fg.name, level: fg.level },
      plantCode,
      ...result,
    });

    // Explode using THIS PLANT'S BOM
    const children = plantBOM[fgCode];
    if (!children) continue;

    for (const child of children) {
      if (!dependentDemand[child.childCode]) {
        dependentDemand[child.childCode] = new Array(periods.length).fill(0);
      }
      const scrapFactor = child.scrapPct > 0 ? 1 / (1 - child.scrapPct / 100) : 1;
      for (let t = 0; t < periods.length; t++) {
        dependentDemand[child.childCode][t] +=
          result.records[t].plannedOrderRelease * child.qtyPer * scrapFactor;
      }
    }
  }

  // Phase 2: Subassemblies (Level 1) — using this plant's BOM
  const level1Codes = [...new Set(
    Object.values(plantBOM)
      .flat()
      .map(c => c.childCode)
      .filter(code => {
        const sku = getSkuByCode(code);
        return sku && sku.level === 1;
      })
  )];

  for (const subCode of level1Codes) {
    const sub = getSkuByCode(subCode);
    if (!sub) continue;

    const grossReqs = dependentDemand[subCode] || new Array(periods.length).fill(0);
    const sr = schedReceipts[subCode] || new Array(periods.length).fill(0);

    const result = runMRP({
      sku: { id: subCode, code: subCode },
      periods,
      grossReqs,
      scheduledReceipts: sr,
      onHand: sub.onHand,
      safetyStock: sub.safetyStock,
      leadTimePeriods: sub.leadTimePeriods,
      lotSizing: sub.lotSizing,
    });

    mrpResults.push({
      sku: { code: subCode, name: sub.name, level: sub.level },
      plantCode,
      ...result,
    });

    // Explode sub's BOM (plant-specific)
    const children = plantBOM[subCode];
    if (!children) continue;

    for (const child of children) {
      if (!dependentDemand[child.childCode]) {
        dependentDemand[child.childCode] = new Array(periods.length).fill(0);
      }
      const scrapFactor = child.scrapPct > 0 ? 1 / (1 - child.scrapPct / 100) : 1;
      for (let t = 0; t < periods.length; t++) {
        dependentDemand[child.childCode][t] +=
          result.records[t].plannedOrderRelease * child.qtyPer * scrapFactor;
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
    const sr = schedReceipts[rawCode] || new Array(periods.length).fill(0);

    const result = runMRP({
      sku: { id: rawCode, code: rawCode },
      periods,
      grossReqs,
      scheduledReceipts: sr,
      onHand: raw.onHand,
      safetyStock: raw.safetyStock,
      leadTimePeriods: raw.leadTimePeriods,
      lotSizing: raw.lotSizing,
    });

    mrpResults.push({
      sku: { code: rawCode, name: raw.name, level: raw.level },
      plantCode,
      ...result,
    });
  }

  return { mrpResults, periods, dependentDemand, plantCode };
}

// ─── Legacy: Run MRP using flat BOM (for backward compat) ───────

function runFullMRP(demandOverrides) {
  const forecast = generateDemandForecast();
  const { periods } = forecast;
  const fgDemand = demandOverrides?.finishedGoods || forecast.finishedGoods;
  const schedReceipts = demandOverrides?.scheduledReceipts || forecast.scheduledReceipts || {};
  const mrpResults = [];
  const dependentDemand = {};

  function processLevel(level) {
    const items = skuMaster.filter(s => s.level === level);
    for (const item of items) {
      const grossReqs = level === 0
        ? (fgDemand[item.code] || new Array(periods.length).fill(0))
        : (dependentDemand[item.code] || new Array(periods.length).fill(0));
      const sr = schedReceipts[item.code] || new Array(periods.length).fill(0);

      const result = runMRP({
        sku: { id: item.code, code: item.code },
        periods,
        grossReqs,
        scheduledReceipts: sr,
        onHand: item.onHand,
        safetyStock: item.safetyStock,
        leadTimePeriods: item.leadTimePeriods,
        lotSizing: item.lotSizing,
      });

      mrpResults.push({ sku: { code: item.code, name: item.name, level: item.level }, ...result });

      const children = bomTree[item.code];
      if (!children) continue;
      for (const child of children) {
        if (!dependentDemand[child.childCode]) {
          dependentDemand[child.childCode] = new Array(periods.length).fill(0);
        }
        const scrapFactor = child.scrapPct > 0 ? 1 / (1 - child.scrapPct / 100) : 1;
        for (let t = 0; t < periods.length; t++) {
          dependentDemand[child.childCode][t] +=
            result.records[t].plannedOrderRelease * child.qtyPer * scrapFactor;
        }
      }
    }
  }

  processLevel(0);
  processLevel(1);
  processLevel(2);

  return { mrpResults, periods, dependentDemand };
}

// ─── GET /api/mrp/demo — All plants (legacy flat BOM) ───────────

mrpRouter.get('/demo', (req, res) => {
  try {
    const plant = req.query.plant;

    let mrpResults, periods;
    if (plant && plantBOMs[plant]) {
      ({ mrpResults, periods } = runPlantMRP(plant));
    } else {
      ({ mrpResults, periods } = runFullMRP());
    }

    const summary = formatMRPSummary(mrpResults);
    const totalExceptions = mrpResults.reduce((sum, r) => sum + r.exceptions.length, 0);
    const criticalCount = mrpResults.reduce(
      (sum, r) => sum + r.exceptions.filter(e => e.severity === 'critical').length, 0
    );

    res.json({
      status: 'ok',
      plant: plant || 'all',
      periods,
      skusPlanned: mrpResults.length,
      totalExceptions,
      criticalExceptions: criticalCount,
      results: summary,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/mrp/demo/analyze — MRP + AI stream ───────────────

mrpRouter.post('/demo/analyze', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const { question, plant } = req.body || {};
    let mrpResults, periods;

    if (plant && plantBOMs[plant]) {
      ({ mrpResults, periods } = runPlantMRP(plant));
    } else {
      ({ mrpResults, periods } = runFullMRP());
    }

    const { systemPrompt, userMessage } = buildMRPContext({
      mrpResults,
      bomTree: plant ? plantBOMs[plant] : bomTree,
      periods,
      plannerQuestion: question,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const summary = formatMRPSummary(mrpResults);
    res.write(`event: mrp-results\ndata: ${JSON.stringify({ periods, plant, results: summary })}\n\n`);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
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

// ─── GET /api/mrp/bom — Plant-specific BOM tree ─────────────────

mrpRouter.get('/bom', (req, res) => {
  try {
    const plant = req.query.plant || 'PLANT-NORTH';
    const bom = plantBOMs[plant];
    if (!bom) return res.status(404).json({ error: `No BOM for plant ${plant}` });

    const plantProducts = getProductsForPlant(plant);

    // Build tree structure: FG → children → grandchildren
    const tree = [];
    for (const fgCode of plantProducts) {
      const fg = getSkuByCode(fgCode);
      if (!fg) continue;

      const children = (bom[fgCode] || []).map(child => {
        const childSku = getSkuByCode(child.childCode);
        const grandchildren = (bom[child.childCode] || []).map(gc => {
          const gcSku = getSkuByCode(gc.childCode);
          return {
            code: gc.childCode,
            name: gcSku?.name || gc.childCode,
            level: gcSku?.level ?? 2,
            qtyPer: gc.qtyPer,
            scrapPct: gc.scrapPct,
            leadTime: gcSku?.leadTimePeriods,
            lotSizing: gcSku?.lotSizing?.method,
            onHand: gcSku?.onHand,
            safetyStock: gcSku?.safetyStock,
          };
        });

        return {
          code: child.childCode,
          name: childSku?.name || child.childCode,
          level: childSku?.level ?? 1,
          qtyPer: child.qtyPer,
          scrapPct: child.scrapPct,
          leadTime: childSku?.leadTimePeriods,
          lotSizing: childSku?.lotSizing?.method,
          onHand: childSku?.onHand,
          safetyStock: childSku?.safetyStock,
          children: grandchildren,
        };
      });

      tree.push({
        code: fgCode,
        name: fg.name,
        level: 0,
        leadTime: fg.leadTimePeriods,
        lotSizing: fg.lotSizing?.method,
        onHand: fg.onHand,
        safetyStock: fg.safetyStock,
        children,
      });
    }

    res.json({ plant, tree, totalItems: skuMaster.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/mrp/run — Custom data ────────────────────────────

mrpRouter.post('/run', (req, res) => {
  try {
    const { finishedGoods, scheduledReceipts, plant } = req.body || {};
    let mrpResults, periods;

    if (plant && plantBOMs[plant]) {
      ({ mrpResults, periods } = runPlantMRP(plant, { finishedGoods, scheduledReceipts }));
    } else {
      ({ mrpResults, periods } = runFullMRP({ finishedGoods, scheduledReceipts }));
    }

    const summary = formatMRPSummary(mrpResults);
    res.json({
      status: 'ok',
      plant: plant || 'all',
      periods,
      skusPlanned: mrpResults.length,
      results: summary,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
