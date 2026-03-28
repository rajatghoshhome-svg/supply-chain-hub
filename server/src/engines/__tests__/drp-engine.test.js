/**
 * DRP Engine Tests — ASCM/APICS Compliance
 *
 * Written FIRST. DRP (Distribution Requirements Planning) follows the
 * same gross-to-net logic as MRP but operates at the distribution level:
 *
 *   - Input: DC-level demand forecast + DC inventory + network lanes
 *   - Output: Planned shipments from source (plant) to DC
 *   - Key output: Aggregated plant-level gross requirements (feeds into Prod Plan → MRP)
 *
 * ASCM MPC Framework position:
 *   Demand Plan → DRP → Production Plan → MPS → MRP
 *
 * DRP is NOT MRP for finished goods. DRP specifically:
 *   1. Operates per-SKU per-location (DC level)
 *   2. Generates planned SHIPMENTS (not production orders)
 *   3. Offsets by TRANSIT lead time (not manufacturing lead time)
 *   4. Aggregates across all DCs to create plant-level gross requirements
 *   5. Handles fair-share allocation when plant supply < total DC demand
 */

import { describe, it, expect } from 'vitest';
import {
  runDRP,
  runDRPForLocation,
  aggregatePlantRequirements,
  fairShareAllocation,
} from '../drp-engine.js';

// ─── Test Data Helpers ────────────────────────────────────────────

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

// ─── 1. Single-Location DRP Netting ──────────────────────────────

describe('DRP Single-Location Netting', () => {
  it('calculates projected OH and net requirements at a DC', () => {
    // DC-East: OH=15, SS=5, demand=[8,10,9,11]
    // Period 1: 15 - 8 = 7, >= SS(5) → net=0
    // Period 2: 7 - 10 = -3, < SS(5) → net = 5-(-3) = 8, OH resets to 5
    // Period 3: 5 - 9 = -4, < 5 → net = 9, OH resets to 5
    // Period 4: 5 - 11 = -6, < 5 → net = 11, OH resets to 5
    const result = runDRPForLocation({
      skuCode: 'MTR-100',
      locationCode: 'DC-EAST',
      periods: makePeriods(4),
      grossReqs: [8, 10, 9, 11],
      scheduledReceipts: [0, 0, 0, 0],
      onHand: 15,
      safetyStock: 5,
      transitLeadTime: 1,
      sourceCode: 'PLANT-MAIN',
    });

    expect(result.records).toHaveLength(4);
    expect(result.records[0].netReq).toBe(0);
    expect(result.records[1].netReq).toBe(8);
    expect(result.records[2].netReq).toBe(9);
    expect(result.records[3].netReq).toBe(11);
  });

  it('generates planned shipments equal to net requirements', () => {
    const result = runDRPForLocation({
      skuCode: 'MTR-100',
      locationCode: 'DC-EAST',
      periods: makePeriods(4),
      grossReqs: [20, 10, 10, 10],
      scheduledReceipts: [0, 0, 0, 0],
      onHand: 15,
      safetyStock: 5,
      transitLeadTime: 0,
      sourceCode: 'PLANT-MAIN',
    });

    // Net req in period 1: 15-20 = -5, need 10 (to get to SS=5)
    expect(result.records[0].plannedShipment).toBe(10);
    expect(result.records[0].plannedShipment).toBe(result.records[0].netReq);
  });

  it('offsets planned shipments by transit lead time', () => {
    // Transit LT = 2 periods. If DC needs receipt in period 4,
    // the planned shipment release at the plant should be in period 2
    const result = runDRPForLocation({
      skuCode: 'MTR-100',
      locationCode: 'DC-WEST',
      periods: makePeriods(6),
      grossReqs: [0, 0, 0, 50, 0, 0],
      scheduledReceipts: [0, 0, 0, 0, 0, 0],
      onHand: 0,
      safetyStock: 0,
      transitLeadTime: 2,
      sourceCode: 'PLANT-MAIN',
    });

    // Receipt needed in period 4 (index 3)
    expect(result.records[3].plannedShipment).toBe(50);
    // Release at plant should be in period 2 (index 1)
    expect(result.records[1].plannedShipmentRelease).toBe(50);
  });

  it('generates expedite when transit LT exceeds available time', () => {
    // Need receipt in period 1, transit LT = 3
    const result = runDRPForLocation({
      skuCode: 'MTR-100',
      locationCode: 'DC-WEST',
      periods: makePeriods(4),
      grossReqs: [100, 0, 0, 0],
      scheduledReceipts: [0, 0, 0, 0],
      onHand: 0,
      safetyStock: 0,
      transitLeadTime: 3,
      sourceCode: 'PLANT-MAIN',
    });

    const expedites = result.exceptions.filter(e => e.type === 'expedite');
    expect(expedites.length).toBeGreaterThanOrEqual(1);
  });

  it('accounts for scheduled receipts (in-transit shipments)', () => {
    // DC has a shipment arriving in period 2
    const result = runDRPForLocation({
      skuCode: 'MTR-100',
      locationCode: 'DC-EAST',
      periods: makePeriods(4),
      grossReqs: [10, 10, 10, 10],
      scheduledReceipts: [0, 20, 0, 0],
      onHand: 5,
      safetyStock: 0,
      transitLeadTime: 1,
      sourceCode: 'PLANT-MAIN',
    });

    // Period 1: 5 - 10 = -5 → net=5
    // Period 2: 0 + 20 - 10 = 10 → net=0 (scheduled receipt covers it)
    expect(result.records[0].netReq).toBe(5);
    expect(result.records[1].netReq).toBe(0);
  });

  it('returns records with all required DRP fields', () => {
    const result = runDRPForLocation({
      skuCode: 'MTR-100',
      locationCode: 'DC-EAST',
      periods: makePeriods(2),
      grossReqs: [10, 20],
      scheduledReceipts: [0, 0],
      onHand: 5,
      safetyStock: 0,
      transitLeadTime: 0,
      sourceCode: 'PLANT-MAIN',
    });

    const rec = result.records[0];
    expect(rec).toHaveProperty('period');
    expect(rec).toHaveProperty('locationCode');
    expect(rec).toHaveProperty('grossReq');
    expect(rec).toHaveProperty('scheduledReceipts');
    expect(rec).toHaveProperty('projectedOH');
    expect(rec).toHaveProperty('netReq');
    expect(rec).toHaveProperty('plannedShipment');
    expect(rec).toHaveProperty('plannedShipmentRelease');
    expect(rec).toHaveProperty('sourceCode');
  });
});

// ─── 2. Multi-Location DRP → Plant Aggregation ──────────────────

describe('Plant-Level Requirement Aggregation', () => {
  it('aggregates DC planned shipment releases into plant gross requirements', () => {
    // DC-East releases: [10, 20, 0, 0]
    // DC-West releases:  [5, 10, 15, 0]
    // DC-Central releases: [0, 5, 10, 10]
    // Plant gross req:  [15, 35, 25, 10]

    const dcResults = [
      { locationCode: 'DC-EAST', records: makePeriods(4).map((p, i) => ({ period: p, plannedShipmentRelease: [10, 20, 0, 0][i] })) },
      { locationCode: 'DC-WEST', records: makePeriods(4).map((p, i) => ({ period: p, plannedShipmentRelease: [5, 10, 15, 0][i] })) },
      { locationCode: 'DC-CENTRAL', records: makePeriods(4).map((p, i) => ({ period: p, plannedShipmentRelease: [0, 5, 10, 10][i] })) },
    ];

    const plantReqs = aggregatePlantRequirements({
      dcResults,
      plantCode: 'PLANT-MAIN',
      periods: makePeriods(4),
    });

    expect(plantReqs.grossReqs).toEqual([15, 35, 25, 10]);
    expect(plantReqs.plantCode).toBe('PLANT-MAIN');
  });

  it('produces per-DC breakdown for traceability', () => {
    const dcResults = [
      { locationCode: 'DC-EAST', records: makePeriods(2).map((p, i) => ({ period: p, plannedShipmentRelease: [10, 20][i] })) },
      { locationCode: 'DC-WEST', records: makePeriods(2).map((p, i) => ({ period: p, plannedShipmentRelease: [5, 10][i] })) },
    ];

    const plantReqs = aggregatePlantRequirements({
      dcResults,
      plantCode: 'PLANT-MAIN',
      periods: makePeriods(2),
    });

    // Should have per-DC contribution
    expect(plantReqs.byDC['DC-EAST']).toEqual([10, 20]);
    expect(plantReqs.byDC['DC-WEST']).toEqual([5, 10]);
  });
});

// ─── 3. Fair-Share Allocation ─────────────────────────────────────

describe('Fair-Share Allocation', () => {
  it('allocates proportionally when supply < total demand', () => {
    // Available at plant: 100
    // DC-East wants: 60 (60%)
    // DC-West wants: 40 (40%)
    // But only 80 available → fair share: 48, 32
    const allocation = fairShareAllocation({
      available: 80,
      demands: [
        { locationCode: 'DC-EAST', demand: 60 },
        { locationCode: 'DC-WEST', demand: 40 },
      ],
    });

    expect(allocation).toHaveLength(2);
    const east = allocation.find(a => a.locationCode === 'DC-EAST');
    const west = allocation.find(a => a.locationCode === 'DC-WEST');

    // 60/(60+40) * 80 = 48
    expect(east.allocated).toBe(48);
    // 40/(60+40) * 80 = 32
    expect(west.allocated).toBe(32);
    // Total should equal available
    expect(east.allocated + west.allocated).toBe(80);
  });

  it('allocates full demand when supply >= total demand', () => {
    const allocation = fairShareAllocation({
      available: 200,
      demands: [
        { locationCode: 'DC-EAST', demand: 60 },
        { locationCode: 'DC-WEST', demand: 40 },
      ],
    });

    expect(allocation.find(a => a.locationCode === 'DC-EAST').allocated).toBe(60);
    expect(allocation.find(a => a.locationCode === 'DC-WEST').allocated).toBe(40);
  });

  it('handles zero demand from one location', () => {
    const allocation = fairShareAllocation({
      available: 50,
      demands: [
        { locationCode: 'DC-EAST', demand: 50 },
        { locationCode: 'DC-WEST', demand: 0 },
      ],
    });

    expect(allocation.find(a => a.locationCode === 'DC-EAST').allocated).toBe(50);
    expect(allocation.find(a => a.locationCode === 'DC-WEST').allocated).toBe(0);
  });

  it('handles zero available supply', () => {
    const allocation = fairShareAllocation({
      available: 0,
      demands: [
        { locationCode: 'DC-EAST', demand: 50 },
        { locationCode: 'DC-WEST', demand: 30 },
      ],
    });

    expect(allocation.every(a => a.allocated === 0)).toBe(true);
  });

  it('rounds allocations to integers and preserves total', () => {
    // 100 / 3 DCs with equal demand → can't split evenly
    const allocation = fairShareAllocation({
      available: 100,
      demands: [
        { locationCode: 'DC-A', demand: 50 },
        { locationCode: 'DC-B', demand: 50 },
        { locationCode: 'DC-C', demand: 50 },
      ],
    });

    const total = allocation.reduce((s, a) => s + a.allocated, 0);
    expect(total).toBe(100); // no rounding leakage
    // Each should get ~33
    for (const a of allocation) {
      expect(a.allocated).toBeGreaterThanOrEqual(33);
      expect(a.allocated).toBeLessThanOrEqual(34);
    }
  });
});

// ─── 4. Full DRP Run (Multi-SKU, Multi-Location) ────────────────

describe('Full DRP Run', () => {
  it('runs DRP across all DCs for a single SKU', () => {
    const result = runDRP({
      skuCode: 'MTR-100',
      periods: makePeriods(4),
      locations: [
        { code: 'DC-EAST', onHand: 15, safetyStock: 5, scheduledReceipts: [0, 0, 0, 0], grossReqs: [8, 10, 9, 11], transitLeadTime: 1, sourceCode: 'PLANT-MAIN' },
        { code: 'DC-WEST', onHand: 10, safetyStock: 4, grossReqs: [4, 5, 5, 6], scheduledReceipts: [0, 0, 0, 0], transitLeadTime: 2, sourceCode: 'PLANT-MAIN' },
      ],
    });

    expect(result.dcResults).toHaveLength(2);
    expect(result.plantRequirements).toBeDefined();
    expect(result.plantRequirements.grossReqs).toHaveLength(4);
  });

  it('plant gross requirements are sum of all DC shipment releases', () => {
    const result = runDRP({
      skuCode: 'MTR-100',
      periods: makePeriods(4),
      locations: [
        { code: 'DC-A', onHand: 0, safetyStock: 0, scheduledReceipts: [0, 0, 0, 0], grossReqs: [10, 10, 10, 10], transitLeadTime: 0, sourceCode: 'PLANT-X' },
        { code: 'DC-B', onHand: 0, safetyStock: 0, scheduledReceipts: [0, 0, 0, 0], grossReqs: [5, 5, 5, 5], transitLeadTime: 0, sourceCode: 'PLANT-X' },
      ],
    });

    // With LT=0, releases = receipts = net reqs
    // DC-A needs 10/period, DC-B needs 5/period → plant needs 15/period
    expect(result.plantRequirements.grossReqs).toEqual([15, 15, 15, 15]);
  });

  it('transit lead time shifts when the plant sees the demand', () => {
    // DC-A: LT=2, needs 100 in period 4 (index 3)
    // Plant should see the demand in period 2 (index 1)
    const result = runDRP({
      skuCode: 'MTR-100',
      periods: makePeriods(6),
      locations: [
        { code: 'DC-A', onHand: 0, safetyStock: 0, scheduledReceipts: [0, 0, 0, 0, 0, 0], grossReqs: [0, 0, 0, 100, 0, 0], transitLeadTime: 2, sourceCode: 'PLANT-X' },
      ],
    });

    // Plant gross req should peak in period 2 (index 1) due to LT offset
    expect(result.plantRequirements.grossReqs[1]).toBe(100);
    expect(result.plantRequirements.grossReqs[3]).toBe(0); // not period 4
  });
});

// ─── 5. Edge Cases ────────────────────────────────────────────────

describe('DRP Edge Cases', () => {
  it('handles single location', () => {
    const result = runDRP({
      skuCode: 'MTR-100',
      periods: makePeriods(3),
      locations: [
        { code: 'DC-ONLY', onHand: 10, safetyStock: 0, scheduledReceipts: [0, 0, 0], grossReqs: [5, 5, 5], transitLeadTime: 0, sourceCode: 'PLANT' },
      ],
    });

    expect(result.dcResults).toHaveLength(1);
    expect(result.plantRequirements.grossReqs).toHaveLength(3);
  });

  it('handles zero demand across all locations', () => {
    const result = runDRP({
      skuCode: 'MTR-100',
      periods: makePeriods(3),
      locations: [
        { code: 'DC-A', onHand: 50, safetyStock: 0, scheduledReceipts: [0, 0, 0], grossReqs: [0, 0, 0], transitLeadTime: 0, sourceCode: 'PLANT' },
      ],
    });

    expect(result.plantRequirements.grossReqs).toEqual([0, 0, 0]);
  });
});
