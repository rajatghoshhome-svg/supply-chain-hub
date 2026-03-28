/**
 * MRP Full Run Integration Test
 *
 * Tests the complete MRP pipeline using synthetic data:
 *   Finished goods demand → BOM explosion → dependent demand → all levels planned
 *
 * This is the validation spike's core proof: does the deterministic engine
 * produce correct, cascaded MRP results across a 3-level BOM?
 */

import { describe, it, expect } from 'vitest';
import { runMRP, explodeBOM } from '../mrp-engine.js';
import { skuMaster, bomTree, generateDemandForecast, getSkuByCode } from '../../data/synthetic-bom.js';
import { buildMRPContext, formatMRPSummary } from '../../services/ai-context/mrp-context.js';

describe('Full MRP Run with Synthetic Data', () => {
  const forecast = generateDemandForecast();
  const { periods } = forecast;

  it('plans all SKUs across 3 levels', () => {
    const results = runAllLevels(forecast);
    expect(results.length).toBe(skuMaster.length);
  });

  it('generates dependent demand from FG to subassemblies', () => {
    const results = runAllLevels(forecast);

    // MTR-100 week 1 demand = 15. OH=12, SS=5. netReq = max(0, 5 - (12-15)) = 8
    // MTR-100 uses 1x STAT-A → STAT-A should get dependent demand from MTR-100 releases
    const mtr100 = results.find(r => r.sku.code === 'MTR-100');
    const statA = results.find(r => r.sku.code === 'STAT-A');

    // FG releases should be > 0 in first few periods
    const totalFGReleases = mtr100.records.reduce((s, r) => s + r.plannedOrderRelease, 0);
    expect(totalFGReleases).toBeGreaterThan(0);

    // Subassembly should have gross requirements
    const totalSubGrossReq = statA.records.reduce((s, r) => s + r.grossReq, 0);
    expect(totalSubGrossReq).toBeGreaterThan(0);
  });

  it('cascades demand from subassemblies to raw materials', () => {
    const results = runAllLevels(forecast);

    // LAM-STEEL is used by STAT-A (×2.5, 8% scrap), STAT-B (×4.0, 8% scrap),
    // ROT-A (×1.8, 8% scrap), ROT-B (×3.2, 8% scrap)
    const lamSteel = results.find(r => r.sku.code === 'LAM-STEEL');
    const totalGrossReq = lamSteel.records.reduce((s, r) => s + r.grossReq, 0);

    // Should be substantial — multiple parents driving demand
    expect(totalGrossReq).toBeGreaterThan(100);
  });

  it('respects lead time offsetting at all levels', () => {
    const results = runAllLevels(forecast);

    // MTR-500 has LT=2 periods. If it plans a receipt in period 4,
    // the release should be in period 2 (or earlier, with expedite)
    const mtr500 = results.find(r => r.sku.code === 'MTR-500');
    const receipts = mtr500.records.map(r => r.plannedOrderReceipt);
    const releases = mtr500.records.map(r => r.plannedOrderRelease);

    // Releases should be shifted earlier than receipts
    // (at least some releases should appear in earlier periods)
    const firstReceiptPeriod = receipts.findIndex(r => r > 0);
    const firstReleasePeriod = releases.findIndex(r => r > 0);

    if (firstReceiptPeriod >= 2) {
      expect(firstReleasePeriod).toBeLessThan(firstReceiptPeriod);
    }
    // If receipt needed in period 0 or 1, expedite exception should exist
    if (firstReceiptPeriod >= 0 && firstReceiptPeriod < 2) {
      const hasExpedite = mtr500.exceptions.some(e => e.type === 'expedite');
      // Either expedited or release is in period 0
      expect(hasExpedite || firstReleasePeriod === 0).toBe(true);
    }
  });

  it('applies correct lot sizing per SKU', () => {
    const results = runAllLevels(forecast);

    // HOUS-SM uses FOQ=20. All planned receipts should be multiples of 20
    const housing = results.find(r => r.sku.code === 'HOUS-SM');
    for (const rec of housing.records) {
      if (rec.plannedOrderReceipt > 0) {
        expect(rec.plannedOrderReceipt % 20).toBe(0);
      }
    }

    // BEAR-6205 uses FOQ=50
    const bearing = results.find(r => r.sku.code === 'BEAR-6205');
    for (const rec of bearing.records) {
      if (rec.plannedOrderReceipt > 0) {
        expect(rec.plannedOrderReceipt % 50).toBe(0);
      }
    }
  });

  it('shared components aggregate demand from multiple parents', () => {
    const results = runAllLevels(forecast);

    // CU-WIRE is used by STAT-A, STAT-B, ROT-A, ROT-B
    // Its gross requirement should be the sum of all parent releases × qtyPer × scrapFactor
    const cuWire = results.find(r => r.sku.code === 'CU-WIRE');
    const statA = results.find(r => r.sku.code === 'STAT-A');
    const statB = results.find(r => r.sku.code === 'STAT-B');
    const rotA = results.find(r => r.sku.code === 'ROT-A');
    const rotB = results.find(r => r.sku.code === 'ROT-B');

    // Verify CU-WIRE gross reqs are driven by ALL 4 parents
    // (at least some gross req should exist if any parent releases orders)
    const parentsTotalReleases =
      statA.records.reduce((s, r) => s + r.plannedOrderRelease, 0) +
      statB.records.reduce((s, r) => s + r.plannedOrderRelease, 0) +
      rotA.records.reduce((s, r) => s + r.plannedOrderRelease, 0) +
      rotB.records.reduce((s, r) => s + r.plannedOrderRelease, 0);

    const cuWireTotalGross = cuWire.records.reduce((s, r) => s + r.grossReq, 0);

    if (parentsTotalReleases > 0) {
      expect(cuWireTotalGross).toBeGreaterThan(0);
    }
  });

  it('generates exceptions when supply-demand misaligned', () => {
    const results = runAllLevels(forecast);

    // With realistic demand patterns and limited OH, some exceptions should exist
    const allExceptions = results.flatMap(r => r.exceptions);
    // At least some exceptions should be generated (demand exceeds on-hand)
    expect(allExceptions.length).toBeGreaterThan(0);
  });

  it('AI context builder produces valid prompt from full results', () => {
    const results = runAllLevels(forecast);

    const { systemPrompt, userMessage } = buildMRPContext({
      mrpResults: results,
      bomTree,
      periods,
    });

    // System prompt is well-formed
    expect(systemPrompt.length).toBeGreaterThan(100);
    expect(systemPrompt).toContain('ASCM/APICS');

    // User message contains all sections
    expect(userMessage).toContain('MRP Run Results');
    expect(userMessage).toContain('Exception Summary');
    expect(userMessage).toContain('BOM Structure');

    // User message contains real SKU data
    expect(userMessage).toContain('MTR-100');
    expect(userMessage).toContain('LAM-STEEL');
  });

  it('formatMRPSummary aggregates correctly', () => {
    const results = runAllLevels(forecast);
    const summary = formatMRPSummary(results);

    expect(summary.length).toBe(skuMaster.length);
    for (const s of summary) {
      expect(s.skuCode).toBeDefined();
      expect(s.totalNetReq).toBeGreaterThanOrEqual(0);
      expect(s.records.length).toBe(periods.length);
    }
  });
});

// ─── Helper: run MRP across all 3 levels with BOM explosion ──────

function runAllLevels(forecast) {
  const { periods } = forecast;
  const results = [];
  const dependentDemand = {};

  function processByLevel(level) {
    const items = skuMaster.filter(s => s.level === level);

    for (const item of items) {
      const grossReqs = level === 0
        ? (forecast.finishedGoods[item.code] || new Array(periods.length).fill(0))
        : (dependentDemand[item.code] || new Array(periods.length).fill(0));

      const sr = forecast.scheduledReceipts[item.code] || new Array(periods.length).fill(0);

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

      results.push({ sku: { code: item.code, name: item.name, level: item.level }, ...result });

      // Explode BOM for this item
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

  processByLevel(0);
  processByLevel(1);
  processByLevel(2);

  return results;
}
