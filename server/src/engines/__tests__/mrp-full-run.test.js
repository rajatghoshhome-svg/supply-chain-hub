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
import { skuMaster, bomTree, generateDemandForecast, getSkuByCode } from '../../services/data-provider.js';
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

    // GRN-BAR (FG, level 0) uses MIX-OAT (SUB, level 1)
    const grnBar = results.find(r => r.sku.code === 'GRN-BAR');
    const mixOat = results.find(r => r.sku.code === 'MIX-OAT');

    // FG releases should be > 0 in first few periods
    const totalFGReleases = grnBar.records.reduce((s, r) => s + r.plannedOrderRelease, 0);
    expect(totalFGReleases).toBeGreaterThan(0);

    // Subassembly should have gross requirements from FG explosion
    const totalSubGrossReq = mixOat.records.reduce((s, r) => s + r.grossReq, 0);
    expect(totalSubGrossReq).toBeGreaterThan(0);
  });

  it('cascades demand from subassemblies to raw materials', () => {
    const results = runAllLevels(forecast);

    // OAT-RLD (raw material) is used by MIX-OAT and MIX-TRL subassemblies
    const oatRld = results.find(r => r.sku.code === 'OAT-RLD');
    const totalGrossReq = oatRld.records.reduce((s, r) => s + r.grossReq, 0);

    // Should be substantial — multiple parents driving demand
    expect(totalGrossReq).toBeGreaterThan(100);
  });

  it('respects lead time offsetting at all levels', () => {
    const results = runAllLevels(forecast);

    // KMB-GNG has LT=4 days → 1 period. If it plans a receipt in period 3,
    // the release should be in period 2 (offset by lead time)
    const kmbGng = results.find(r => r.sku.code === 'KMB-GNG');
    const receipts = kmbGng.records.map(r => r.plannedOrderReceipt);
    const releases = kmbGng.records.map(r => r.plannedOrderRelease);

    // Releases should be shifted earlier than receipts
    const firstReceiptPeriod = receipts.findIndex(r => r > 0);
    const firstReleasePeriod = releases.findIndex(r => r > 0);

    if (firstReceiptPeriod >= 2) {
      expect(firstReleasePeriod).toBeLessThan(firstReceiptPeriod);
    }
    // If receipt needed in period 0 or 1, expedite exception should exist
    if (firstReceiptPeriod >= 0 && firstReceiptPeriod < 2) {
      const hasExpedite = kmbGng.exceptions.some(e => e.type === 'expedite');
      expect(hasExpedite || firstReleasePeriod === 0).toBe(true);
    }
  });

  it('applies correct lot sizing per SKU', () => {
    const results = runAllLevels(forecast);

    // GRN-BAR uses FOQ=200. All planned receipts should be multiples of 200
    const grnBar = results.find(r => r.sku.code === 'GRN-BAR');
    for (const rec of grnBar.records) {
      if (rec.plannedOrderReceipt > 0) {
        expect(rec.plannedOrderReceipt % 200).toBe(0);
      }
    }

    // SPK-WAT uses FOQ=500
    const spkWat = results.find(r => r.sku.code === 'SPK-WAT');
    for (const rec of spkWat.records) {
      if (rec.plannedOrderReceipt > 0) {
        expect(rec.plannedOrderReceipt % 500).toBe(0);
      }
    }
  });

  it('shared components aggregate demand from multiple parents', () => {
    const results = runAllLevels(forecast);

    // SGR-ORG (Organic Cane Sugar) is used by multiple subassemblies
    // Its gross requirement should reflect aggregated parent demand
    const sugar = results.find(r => r.sku.code === 'SGR-ORG');

    // Verify sugar has gross reqs driven by parent releases
    const sugarTotalGross = sugar.records.reduce((s, r) => s + r.grossReq, 0);
    expect(sugarTotalGross).toBeGreaterThan(0);
  });

  it('generates exceptions when supply-demand misaligned', () => {
    const results = runAllLevels(forecast);

    // With realistic demand patterns and limited OH, some exceptions should exist
    const allExceptions = results.flatMap(r => r.exceptions);
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

    // User message contains real CPG SKU data
    expect(userMessage).toContain('GRN-BAR');
    expect(userMessage).toContain('OAT-RLD');
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
