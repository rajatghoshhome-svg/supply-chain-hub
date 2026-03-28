/**
 * MRP Engine Tests — ASCM/APICS Compliance
 * Written FIRST (test-first approach). Tests define correct behavior
 * from textbook MRP logic. Implementation fills in until tests pass.
 *
 * MRP Record structure per period:
 *   grossReq          — total demand (from forecast or parent BOM explosion)
 *   scheduledReceipts — open orders already due this period
 *   projectedOH       — projected on-hand at end of period
 *   netReq            — shortfall after netting (0 if projectedOH >= 0)
 *   plannedOrderReceipt — quantity to receive this period to cover netReq
 *   plannedOrderRelease — quantity to release (offset by lead time)
 *
 * Exception types:
 *   expedite         — existing order needs to arrive sooner
 *   reschedule-in    — existing order should move earlier
 *   reschedule-out   — existing order should move later
 *   cancel           — existing order is no longer needed
 */

import { describe, it, expect } from 'vitest';
import {
  runMRP,
  netRequirements,
  explodeBOM,
  lotSize,
  generateExceptions,
} from '../mrp-engine.js';

// ─── Test Data Helpers ────────────────────────────────────────────

function makePeriods(count) {
  const periods = [];
  const base = new Date('2026-04-07'); // Monday
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    periods.push(d.toISOString().slice(0, 10));
  }
  return periods;
}

// ─── 1. Gross-to-Net Netting ──────────────────────────────────────

describe('Gross-to-Net Netting', () => {
  it('calculates projected OH and net requirements correctly', () => {
    // ASCM standard MRP netting (incremental net requirements).
    // Starting OH = 50, no safety stock
    // Period demands: [20, 30, 40, 10, 25]
    //
    // Period 1: OH = 50-20 = 30, >=0 → net=0, OH stays 30
    // Period 2: OH = 30-30 = 0, >=0 → net=0, OH stays 0
    // Period 3: OH = 0-40 = -40, <0 → net=40, OH resets to 0
    // Period 4: OH = 0-10 = -10, <0 → net=10, OH resets to 0
    // Period 5: OH = 0-25 = -25, <0 → net=25, OH resets to 0
    const result = netRequirements({
      periods: makePeriods(5),
      grossReqs: [20, 30, 40, 10, 25],
      scheduledReceipts: [0, 0, 0, 0, 0],
      onHand: 50,
      safetyStock: 0,
    });

    expect(result.projectedOH).toEqual([30, 0, -40, -10, -25]);
    expect(result.netReqs).toEqual([0, 0, 40, 10, 25]);
  });

  it('accounts for scheduled receipts in netting', () => {
    // OH = 10, scheduled receipt of 50 in period 2
    // Demands: [20, 30, 10]
    // Period 1: OH = 10 - 20 = -10, <0 → net=10, OH resets to 0
    // Period 2: OH = 0 + 50 - 30 = 20, >=0 → net=0
    // Period 3: OH = 20 - 10 = 10, >=0 → net=0
    const result = netRequirements({
      periods: makePeriods(3),
      grossReqs: [20, 30, 10],
      scheduledReceipts: [0, 50, 0],
      onHand: 10,
      safetyStock: 0,
    });

    expect(result.projectedOH).toEqual([-10, 20, 10]);
    expect(result.netReqs).toEqual([10, 0, 0]);
  });

  it('includes safety stock in net requirement calculation', () => {
    // OH = 100, safety stock = 20
    // Demands: [30, 40, 50]
    // Net req considers safety stock: need to stay >= SS=20
    // Period 1: OH = 100-30 = 70, 70 >= 20 → net = 0
    // Period 2: OH = 70-40 = 30, 30 >= 20 → net = 0
    // Period 3: OH = 30-50 = -20, -20 < 20 → net = 40 (to get to 20)
    const result = netRequirements({
      periods: makePeriods(3),
      grossReqs: [30, 40, 50],
      scheduledReceipts: [0, 0, 0],
      onHand: 100,
      safetyStock: 20,
    });

    expect(result.netReqs).toEqual([0, 0, 40]);
  });

  it('handles zero demand across all periods', () => {
    const result = netRequirements({
      periods: makePeriods(4),
      grossReqs: [0, 0, 0, 0],
      scheduledReceipts: [0, 0, 0, 0],
      onHand: 100,
      safetyStock: 0,
    });

    expect(result.projectedOH).toEqual([100, 100, 100, 100]);
    expect(result.netReqs).toEqual([0, 0, 0, 0]);
  });

  it('handles starting with negative on-hand (backorder)', () => {
    const result = netRequirements({
      periods: makePeriods(3),
      grossReqs: [10, 10, 10],
      scheduledReceipts: [0, 0, 0],
      onHand: -5,
      safetyStock: 0,
    });

    // Period 1: -5 - 10 = -15, <0 → net=15, OH resets to 0
    // Period 2: 0 - 10 = -10, <0 → net=10, OH resets to 0
    // Period 3: 0 - 10 = -10, <0 → net=10, OH resets to 0
    expect(result.projectedOH).toEqual([-15, -10, -10]);
    expect(result.netReqs).toEqual([15, 10, 10]);
  });
});

// ─── 2. Lot Sizing ───────────────────────────────────────────────

describe('Lot Sizing', () => {
  describe('Lot-for-Lot (L4L)', () => {
    it('orders exactly the net requirement each period', () => {
      const result = lotSize({
        netReqs: [0, 0, 40, 10, 25],
        method: 'lot-for-lot',
      });

      expect(result).toEqual([0, 0, 40, 10, 25]);
    });
  });

  describe('Fixed Order Quantity (FOQ)', () => {
    it('orders in fixed multiples to cover net requirements', () => {
      // FOQ = 50. Net reqs: [0, 0, 40, 10, 25]
      // Period 3: need 40 → order 50 (excess 10 carries forward)
      // Period 4: carried 10, need 10 → covered, order 0
      // Period 5: need 25 → order 50
      const result = lotSize({
        netReqs: [0, 0, 40, 10, 25],
        method: 'fixed-order-qty',
        fixedQty: 50,
      });

      expect(result).toEqual([0, 0, 50, 0, 50]);
    });

    it('handles net requirement larger than fixed qty', () => {
      // FOQ = 30. Net req = 80 → need 3x30 = 90
      const result = lotSize({
        netReqs: [80],
        method: 'fixed-order-qty',
        fixedQty: 30,
      });

      expect(result).toEqual([90]);
    });
  });

  describe('Economic Order Quantity (EOQ)', () => {
    it('calculates EOQ and orders in EOQ-sized batches', () => {
      // EOQ formula: sqrt(2DS/H)
      // D = annual demand = 1000, S = ordering cost = 50, H = holding cost = 2
      // EOQ = sqrt(2*1000*50/2) = sqrt(50000) ≈ 224
      // Net reqs: [100, 150, 200]
      // Period 1: need 100 → order 224, carry 124
      // Period 2: 124 - 150 = -26 → need 26, order 224, carry 198
      // Period 3: 198 - 200 = -2 → need 2, order 224
      const result = lotSize({
        netReqs: [100, 150, 200],
        method: 'eoq',
        annualDemand: 1000,
        orderingCost: 50,
        holdingCost: 2,
      });

      // EOQ rounds to 224
      const eoq = Math.round(Math.sqrt((2 * 1000 * 50) / 2));
      expect(result[0]).toBe(eoq);
      // Verify coverage: sum of orders >= sum of net reqs
      const totalOrdered = result.reduce((s, v) => s + v, 0);
      const totalNeeded = [100, 150, 200].reduce((s, v) => s + v, 0);
      expect(totalOrdered).toBeGreaterThanOrEqual(totalNeeded);
    });
  });

  describe('Period Order Quantity (POQ)', () => {
    it('groups demand into multi-period batches', () => {
      // POQ = 3 periods. Net reqs: [10, 20, 30, 15, 25, 10]
      // Period 1: covers periods 1-3 → 10+20+30 = 60
      // Period 4: covers periods 4-6 → 15+25+10 = 50
      const result = lotSize({
        netReqs: [10, 20, 30, 15, 25, 10],
        method: 'period-order-qty',
        periodsPerOrder: 3,
      });

      expect(result).toEqual([60, 0, 0, 50, 0, 0]);
    });

    it('handles remaining periods less than POQ interval', () => {
      // POQ = 3, but only 5 periods
      // Period 1: covers 1-3 → 10+20+30 = 60
      // Period 4: covers 4-5 → 15+25 = 40
      const result = lotSize({
        netReqs: [10, 20, 30, 15, 25],
        method: 'period-order-qty',
        periodsPerOrder: 3,
      });

      expect(result).toEqual([60, 0, 0, 40, 0]);
    });
  });
});

// ─── 3. Lead Time Offsetting ──────────────────────────────────────

describe('Lead Time Offsetting', () => {
  it('offsets planned order release by lead time', () => {
    // If planned order receipt is in period 4 (index 3),
    // and lead time is 2 periods, release should be in period 2 (index 1)
    const result = runMRP({
      sku: { id: 1, code: 'SKU-A' },
      periods: makePeriods(6),
      grossReqs: [0, 0, 0, 100, 0, 0],
      scheduledReceipts: [0, 0, 0, 0, 0, 0],
      onHand: 0,
      safetyStock: 0,
      leadTimePeriods: 2,
      lotSizing: { method: 'lot-for-lot' },
    });

    // Receipt in period 4 (index 3)
    expect(result.records[3].plannedOrderReceipt).toBe(100);
    // Release in period 2 (index 1), offset by 2
    expect(result.records[1].plannedOrderRelease).toBe(100);
    // No release in other periods
    expect(result.records[0].plannedOrderRelease).toBe(0);
    expect(result.records[2].plannedOrderRelease).toBe(0);
  });

  it('generates expedite exception when release falls before horizon', () => {
    // Need receipt in period 1, lead time = 3 periods
    // Release would need to be in period -2 (past) → exception
    const result = runMRP({
      sku: { id: 1, code: 'SKU-A' },
      periods: makePeriods(4),
      grossReqs: [100, 0, 0, 0],
      scheduledReceipts: [0, 0, 0, 0],
      onHand: 0,
      safetyStock: 0,
      leadTimePeriods: 3,
      lotSizing: { method: 'lot-for-lot' },
    });

    const expedites = result.exceptions.filter(e => e.type === 'expedite');
    expect(expedites.length).toBeGreaterThanOrEqual(1);
    expect(expedites[0].skuCode).toBe('SKU-A');
  });

  it('handles zero lead time (immediate availability)', () => {
    const result = runMRP({
      sku: { id: 1, code: 'SKU-A' },
      periods: makePeriods(3),
      grossReqs: [50, 30, 20],
      scheduledReceipts: [0, 0, 0],
      onHand: 0,
      safetyStock: 0,
      leadTimePeriods: 0,
      lotSizing: { method: 'lot-for-lot' },
    });

    // With zero lead time, release = receipt (same period)
    for (let i = 0; i < 3; i++) {
      expect(result.records[i].plannedOrderRelease)
        .toBe(result.records[i].plannedOrderReceipt);
    }
  });
});

// ─── 4. BOM Explosion ─────────────────────────────────────────────

describe('BOM Explosion', () => {
  it('explodes single-level BOM correctly', () => {
    // Parent SKU-A needs 2x SKU-B and 3x SKU-C per unit
    const bom = {
      'SKU-A': [
        { childCode: 'SKU-B', qtyPer: 2, scrapPct: 0 },
        { childCode: 'SKU-C', qtyPer: 3, scrapPct: 0 },
      ],
    };

    // Parent needs 100 units
    const result = explodeBOM({
      parentCode: 'SKU-A',
      parentQty: 100,
      bomTree: bom,
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skuCode: 'SKU-B', requiredQty: 200 }),
        expect.objectContaining({ skuCode: 'SKU-C', requiredQty: 300 }),
      ])
    );
  });

  it('explodes multi-level BOM (3 levels deep)', () => {
    // SKU-FG (finished good) → SKU-SUB (subassembly) → SKU-RAW (raw material)
    //   FG needs 1x SUB
    //   SUB needs 4x RAW
    // So FG(50) → SUB(50) → RAW(200)
    const bom = {
      'SKU-FG': [
        { childCode: 'SKU-SUB', qtyPer: 1, scrapPct: 0 },
      ],
      'SKU-SUB': [
        { childCode: 'SKU-RAW', qtyPer: 4, scrapPct: 0 },
      ],
    };

    const result = explodeBOM({
      parentCode: 'SKU-FG',
      parentQty: 50,
      bomTree: bom,
    });

    const sub = result.find(r => r.skuCode === 'SKU-SUB');
    const raw = result.find(r => r.skuCode === 'SKU-RAW');

    expect(sub.requiredQty).toBe(50);
    expect(raw.requiredQty).toBe(200);
  });

  it('applies scrap percentage correctly', () => {
    // Need 100 of child, 10% scrap → need to start 100 / (1 - 0.10) ≈ 112
    // Actually ASCM standard: qty * (1 + scrapPct) or qty / (1 - scrapPct)
    // Using qty / (1 - scrapPct) which is more common
    const bom = {
      'SKU-A': [
        { childCode: 'SKU-B', qtyPer: 1, scrapPct: 10 },
      ],
    };

    const result = explodeBOM({
      parentCode: 'SKU-A',
      parentQty: 100,
      bomTree: bom,
    });

    const child = result.find(r => r.skuCode === 'SKU-B');
    // 100 * 1 / (1 - 0.10) = 111.11 → ceil to 112
    expect(child.requiredQty).toBeCloseTo(111.11, 1);
  });

  it('detects circular BOM reference', () => {
    // A → B → C → A (circular)
    const bom = {
      'SKU-A': [{ childCode: 'SKU-B', qtyPer: 1, scrapPct: 0 }],
      'SKU-B': [{ childCode: 'SKU-C', qtyPer: 1, scrapPct: 0 }],
      'SKU-C': [{ childCode: 'SKU-A', qtyPer: 1, scrapPct: 0 }],
    };

    expect(() =>
      explodeBOM({
        parentCode: 'SKU-A',
        parentQty: 100,
        bomTree: bom,
      })
    ).toThrow(/circular/i);
  });

  it('handles BOM with no children (leaf/purchased item)', () => {
    const bom = {};

    const result = explodeBOM({
      parentCode: 'SKU-PURCHASED',
      parentQty: 100,
      bomTree: bom,
    });

    expect(result).toEqual([]);
  });

  it('aggregates demand for shared components across BOM branches', () => {
    // SKU-FG needs: 2x SKU-A and 1x SKU-B
    // SKU-A needs: 3x SKU-SHARED
    // SKU-B needs: 2x SKU-SHARED
    // FG(10) → A(20) + B(10) → SHARED from A = 60, SHARED from B = 20 → total 80
    const bom = {
      'SKU-FG': [
        { childCode: 'SKU-A', qtyPer: 2, scrapPct: 0 },
        { childCode: 'SKU-B', qtyPer: 1, scrapPct: 0 },
      ],
      'SKU-A': [
        { childCode: 'SKU-SHARED', qtyPer: 3, scrapPct: 0 },
      ],
      'SKU-B': [
        { childCode: 'SKU-SHARED', qtyPer: 2, scrapPct: 0 },
      ],
    };

    const result = explodeBOM({
      parentCode: 'SKU-FG',
      parentQty: 10,
      bomTree: bom,
    });

    const shared = result.find(r => r.skuCode === 'SKU-SHARED');
    expect(shared.requiredQty).toBe(80);
  });
});

// ─── 5. Exception Generation ──────────────────────────────────────

describe('Exception Generation', () => {
  it('generates reschedule-in when scheduled receipt is too late', () => {
    // Net req in period 2, but scheduled receipt in period 4
    // → reschedule-in: move receipt from period 4 to period 2
    const exceptions = generateExceptions({
      skuCode: 'SKU-A',
      periods: makePeriods(5),
      netReqs: [0, 50, 0, 0, 0],
      scheduledReceipts: [0, 0, 0, 50, 0],
      plannedOrderReceipts: [0, 50, 0, 0, 0],
    });

    const reschedIn = exceptions.find(e => e.type === 'reschedule-in');
    expect(reschedIn).toBeDefined();
    expect(reschedIn.fromPeriod).toBe(makePeriods(5)[3]);
    expect(reschedIn.toPeriod).toBe(makePeriods(5)[1]);
  });

  it('generates reschedule-out when scheduled receipt is too early', () => {
    // Scheduled receipt in period 1, but no demand until period 4
    // → reschedule-out: move receipt from period 1 to period 4
    const exceptions = generateExceptions({
      skuCode: 'SKU-A',
      periods: makePeriods(5),
      netReqs: [0, 0, 0, 30, 0],
      scheduledReceipts: [30, 0, 0, 0, 0],
      plannedOrderReceipts: [0, 0, 0, 30, 0],
    });

    const reschedOut = exceptions.find(e => e.type === 'reschedule-out');
    expect(reschedOut).toBeDefined();
  });

  it('generates cancel when scheduled receipt has no matching demand', () => {
    // Scheduled receipt of 100 in period 2, zero demand everywhere
    const exceptions = generateExceptions({
      skuCode: 'SKU-A',
      periods: makePeriods(4),
      netReqs: [0, 0, 0, 0],
      scheduledReceipts: [0, 100, 0, 0],
      plannedOrderReceipts: [0, 0, 0, 0],
    });

    const cancel = exceptions.find(e => e.type === 'cancel');
    expect(cancel).toBeDefined();
    expect(cancel.qty).toBe(100);
  });

  it('returns empty exceptions when everything aligns', () => {
    const exceptions = generateExceptions({
      skuCode: 'SKU-A',
      periods: makePeriods(3),
      netReqs: [0, 0, 0],
      scheduledReceipts: [0, 0, 0],
      plannedOrderReceipts: [0, 0, 0],
    });

    expect(exceptions).toEqual([]);
  });
});

// ─── 6. Full MRP Run (Integration) ───────────────────────────────

describe('Full MRP Run', () => {
  it('produces correct time-phased records for a single SKU', () => {
    // Classic textbook example:
    // SKU-A, OH=40, SS=10, LT=1 period, L4L
    // Demands: [20, 30, 40, 25, 35]
    const result = runMRP({
      sku: { id: 1, code: 'SKU-A' },
      periods: makePeriods(5),
      grossReqs: [20, 30, 40, 25, 35],
      scheduledReceipts: [0, 0, 0, 0, 0],
      onHand: 40,
      safetyStock: 10,
      leadTimePeriods: 1,
      lotSizing: { method: 'lot-for-lot' },
    });

    expect(result.records).toHaveLength(5);

    // Period 1: OH = 40 - 20 = 20, 20 >= SS(10) → no net req
    expect(result.records[0].grossReq).toBe(20);
    expect(result.records[0].projectedOH).toBe(20);
    expect(result.records[0].netReq).toBe(0);

    // Period 2: 20 - 30 = -10, below SS(10) by 20 → net req = 20
    // Actually: 20 - 30 = -10. Need to get to at least SS(10). Net = 10 - (-10) = 20
    // With L4L, planned order receipt = 20 in period 2
    // Projected OH after receipt = -10 + 20 = 10
    expect(result.records[1].netReq).toBe(20);
    expect(result.records[1].plannedOrderReceipt).toBe(20);

    // Release is offset by LT=1, so release in period 1
    expect(result.records[0].plannedOrderRelease).toBe(20);
  });

  it('chains BOM explosion into dependent demand', () => {
    // FG needs 2x COMP per unit. FG demand = [50, 0, 0]
    // COMP should have gross req = [100, 0, 0] from BOM explosion
    const bom = {
      'SKU-FG': [
        { childCode: 'SKU-COMP', qtyPer: 2, scrapPct: 0 },
      ],
    };

    const fgResult = runMRP({
      sku: { id: 1, code: 'SKU-FG' },
      periods: makePeriods(3),
      grossReqs: [50, 0, 0],
      scheduledReceipts: [0, 0, 0],
      onHand: 0,
      safetyStock: 0,
      leadTimePeriods: 0,
      lotSizing: { method: 'lot-for-lot' },
    });

    // The planned order releases for FG become the basis for COMP's gross reqs
    // FG releases: [50, 0, 0] (L4L, LT=0)
    // COMP gross reqs = FG releases * qtyPer = [100, 0, 0]
    const compGrossReqs = fgResult.records.map(
      r => r.plannedOrderRelease * 2
    );
    expect(compGrossReqs).toEqual([100, 0, 0]);
  });

  it('returns records with all required fields', () => {
    const result = runMRP({
      sku: { id: 1, code: 'SKU-A' },
      periods: makePeriods(2),
      grossReqs: [10, 20],
      scheduledReceipts: [0, 0],
      onHand: 5,
      safetyStock: 0,
      leadTimePeriods: 0,
      lotSizing: { method: 'lot-for-lot' },
    });

    const record = result.records[0];
    expect(record).toHaveProperty('period');
    expect(record).toHaveProperty('grossReq');
    expect(record).toHaveProperty('scheduledReceipts');
    expect(record).toHaveProperty('projectedOH');
    expect(record).toHaveProperty('netReq');
    expect(record).toHaveProperty('plannedOrderReceipt');
    expect(record).toHaveProperty('plannedOrderRelease');
  });
});

// ─── 7. Edge Cases ────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('handles single period horizon', () => {
    const result = runMRP({
      sku: { id: 1, code: 'SKU-A' },
      periods: makePeriods(1),
      grossReqs: [100],
      scheduledReceipts: [0],
      onHand: 0,
      safetyStock: 0,
      leadTimePeriods: 0,
      lotSizing: { method: 'lot-for-lot' },
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].plannedOrderReceipt).toBe(100);
  });

  it('handles very large quantities without overflow', () => {
    const result = netRequirements({
      periods: makePeriods(2),
      grossReqs: [999999999, 999999999],
      scheduledReceipts: [0, 0],
      onHand: 0,
      safetyStock: 0,
    });

    // Incremental: each period needs its own full demand
    expect(result.netReqs[0]).toBe(999999999);
    expect(result.netReqs[1]).toBe(999999999);
  });

  it('handles fractional quantities from BOM explosion', () => {
    // 1.5 units of child per parent, 7 parents → 10.5 child
    const bom = {
      'SKU-P': [
        { childCode: 'SKU-C', qtyPer: 1.5, scrapPct: 0 },
      ],
    };

    const result = explodeBOM({
      parentCode: 'SKU-P',
      parentQty: 7,
      bomTree: bom,
    });

    expect(result[0].requiredQty).toBeCloseTo(10.5, 2);
  });

  it('handles MOQ (minimum order quantity) in lot sizing', () => {
    // Net req = 15, MOQ = 50 → order 50
    const result = lotSize({
      netReqs: [15],
      method: 'lot-for-lot',
      moq: 50,
    });

    expect(result[0]).toBe(50);
  });
});
