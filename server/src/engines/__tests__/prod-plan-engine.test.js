/**
 * Production Planning Engine Tests — ASCM/APICS Compliance
 *
 * Written FIRST. Production Planning (Aggregate Planning) sits between
 * DRP and MPS in the ASCM MPC framework:
 *
 *   Demand Plan → DRP → Production Plan → MPS → MRP
 *
 * Production Planning determines HOW to produce the plant-level gross
 * requirements from DRP:
 *   - Chase strategy: vary workforce to match demand exactly
 *   - Level strategy: constant production rate, absorb via inventory
 *   - Hybrid strategy: level base + overtime/subcontract for peaks
 *
 * Includes Rough-Cut Capacity Planning (RCCP) to validate the plan
 * is feasible before passing to MPS/MRP.
 */

import { describe, it, expect } from 'vitest';
import {
  chaseStrategy,
  levelStrategy,
  hybridStrategy,
  roughCutCapacity,
  runProductionPlan,
} from '../prod-plan-engine.js';

// ─── Test Data ───────────────────────────────────────────────────

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

// ─── 1. Chase Strategy ──────────────────────────────────────────

describe('Chase Strategy', () => {
  it('production matches demand exactly each period', () => {
    const result = chaseStrategy({
      periods: makePeriods(4),
      grossReqs: [100, 150, 80, 120],
      beginningInventory: 0,
    });

    expect(result.production).toEqual([100, 150, 80, 120]);
    expect(result.endingInventory.every(v => v === 0)).toBe(true);
  });

  it('accounts for beginning inventory in first period', () => {
    const result = chaseStrategy({
      periods: makePeriods(4),
      grossReqs: [100, 150, 80, 120],
      beginningInventory: 30,
    });

    // First period: only need 70 since we have 30 on hand
    expect(result.production[0]).toBe(70);
    expect(result.endingInventory[0]).toBe(0);
  });

  it('does not produce negative amounts', () => {
    const result = chaseStrategy({
      periods: makePeriods(3),
      grossReqs: [20, 50, 80],
      beginningInventory: 100,
    });

    // Excess inventory carries forward, production floors at 0
    expect(result.production.every(p => p >= 0)).toBe(true);
  });

  it('calculates total cost with hiring and layoff costs', () => {
    const result = chaseStrategy({
      periods: makePeriods(4),
      grossReqs: [100, 150, 80, 120],
      beginningInventory: 0,
      costPerUnit: 10,
      hiringCostPerUnit: 3,
      layoffCostPerUnit: 5,
      baselineRate: 100,
    });

    expect(result.totalCost).toBeDefined();
    expect(result.totalCost).toBeGreaterThan(0);
    // Should include production cost + workforce change costs
    expect(result.costBreakdown).toBeDefined();
  });
});

// ─── 2. Level Strategy ──────────────────────────────────────────

describe('Level Strategy', () => {
  it('produces at a constant rate across all periods', () => {
    const result = levelStrategy({
      periods: makePeriods(4),
      grossReqs: [100, 150, 80, 120],
      beginningInventory: 0,
    });

    // All periods should have the same production rate
    const rate = result.production[0];
    expect(result.production.every(p => p === rate)).toBe(true);
  });

  it('level rate covers total demand over the horizon', () => {
    const grossReqs = [100, 150, 80, 120];
    const totalDemand = grossReqs.reduce((a, b) => a + b, 0); // 450

    const result = levelStrategy({
      periods: makePeriods(4),
      grossReqs,
      beginningInventory: 0,
    });

    const totalProduction = result.production.reduce((a, b) => a + b, 0);
    expect(totalProduction).toBeGreaterThanOrEqual(totalDemand);
  });

  it('builds and consumes inventory over the horizon', () => {
    const result = levelStrategy({
      periods: makePeriods(4),
      grossReqs: [100, 150, 80, 120],
      beginningInventory: 0,
    });

    // With level production, inventory fluctuates
    const hasPositive = result.endingInventory.some(v => v > 0);
    expect(hasPositive).toBe(true);
  });

  it('calculates total cost with inventory carrying costs', () => {
    const result = levelStrategy({
      periods: makePeriods(4),
      grossReqs: [100, 150, 80, 120],
      beginningInventory: 0,
      costPerUnit: 10,
      inventoryCarryingCost: 2,
    });

    expect(result.totalCost).toBeDefined();
    expect(result.costBreakdown.inventoryCost).toBeGreaterThan(0);
  });

  it('may have stockouts if rate is too low (generates exception)', () => {
    const result = levelStrategy({
      periods: makePeriods(4),
      grossReqs: [100, 300, 50, 50], // Big spike in period 2
      beginningInventory: 0,
    });

    // Level rate = ceil(500/4) = 125
    // Period 1: 125 - 100 = 25 inventory
    // Period 2: 25 + 125 - 300 = -150 → stockout!
    const hasStockout = result.endingInventory.some(v => v < 0);
    expect(hasStockout).toBe(true);
    expect(result.exceptions.length).toBeGreaterThan(0);
  });
});

// ─── 3. Hybrid Strategy ─────────────────────────────────────────

describe('Hybrid Strategy', () => {
  it('uses base rate for normal demand + overtime for peaks', () => {
    const result = hybridStrategy({
      periods: makePeriods(4),
      grossReqs: [100, 200, 100, 100],
      beginningInventory: 0,
      baseRate: 120,
      maxOvertimeRate: 50,
      overtimeCostPremium: 1.5,
    });

    // Period 2 has demand spike to 200
    // Base (120) + overtime should cover it
    expect(result.production).toHaveLength(4);
    expect(result.overtime).toHaveLength(4);
    // Only period where overtime is needed
    expect(result.overtime[1]).toBeGreaterThan(0);
  });

  it('caps overtime at maximum rate', () => {
    const result = hybridStrategy({
      periods: makePeriods(4),
      grossReqs: [100, 300, 100, 100],
      beginningInventory: 0,
      baseRate: 120,
      maxOvertimeRate: 50,
      overtimeCostPremium: 1.5,
    });

    // Max total = 120 + 50 = 170, but demand is 300 → shortfall
    expect(result.overtime.every(ot => ot <= 50)).toBe(true);
  });

  it('generates subcontract when demand exceeds base + overtime', () => {
    const result = hybridStrategy({
      periods: makePeriods(4),
      grossReqs: [100, 300, 100, 100],
      beginningInventory: 0,
      baseRate: 120,
      maxOvertimeRate: 50,
      overtimeCostPremium: 1.5,
      subcontractCostPremium: 2.0,
    });

    // Period 2: need 300, base=120, OT=50, max=170 → subcontract 130
    // But inventory from period 1 might cover some
    expect(result.subcontract).toBeDefined();
  });

  it('builds inventory in low-demand periods to cover peaks', () => {
    const result = hybridStrategy({
      periods: makePeriods(4),
      grossReqs: [80, 200, 80, 80],
      beginningInventory: 0,
      baseRate: 120,
      maxOvertimeRate: 50,
      overtimeCostPremium: 1.5,
    });

    // Period 1: 120 - 80 = 40 inventory built
    expect(result.endingInventory[0]).toBeGreaterThan(0);
  });
});

// ─── 4. Rough-Cut Capacity Planning (RCCP) ──────────────────────

describe('Rough-Cut Capacity Planning', () => {
  it('checks production plan against work center capacity', () => {
    const result = roughCutCapacity({
      periods: makePeriods(4),
      production: [100, 150, 80, 120],
      workCenters: [
        { code: 'WC-ASSEMBLY', hoursPerUnit: 0.5, capacityHoursPerPeriod: 80 },
        { code: 'WC-WINDING', hoursPerUnit: 0.3, capacityHoursPerPeriod: 50 },
      ],
    });

    expect(result).toHaveLength(2); // One result per work center
    expect(result[0].code).toBe('WC-ASSEMBLY');
    expect(result[0].utilization).toHaveLength(4);
  });

  it('flags overloaded periods (utilization > 100%)', () => {
    const result = roughCutCapacity({
      periods: makePeriods(4),
      production: [100, 200, 100, 100], // 200 spikes
      workCenters: [
        { code: 'WC-ASSEMBLY', hoursPerUnit: 0.5, capacityHoursPerPeriod: 80 },
      ],
    });

    // Period 2: 200 * 0.5 = 100 hrs vs 80 hrs capacity = 125% utilization
    expect(result[0].utilization[1]).toBeGreaterThan(100);
    expect(result[0].overloaded[1]).toBe(true);
  });

  it('returns load hours and available hours per period', () => {
    const result = roughCutCapacity({
      periods: makePeriods(2),
      production: [100, 50],
      workCenters: [
        { code: 'WC-TEST', hoursPerUnit: 0.4, capacityHoursPerPeriod: 60 },
      ],
    });

    // Period 1: 100 * 0.4 = 40 hrs load, 60 hrs capacity
    expect(result[0].loadHours[0]).toBe(40);
    expect(result[0].availableHours[0]).toBe(60);
    // Period 2: 50 * 0.4 = 20 hrs
    expect(result[0].loadHours[1]).toBe(20);
  });

  it('handles multiple work centers independently', () => {
    const result = roughCutCapacity({
      periods: makePeriods(2),
      production: [100, 100],
      workCenters: [
        { code: 'WC-A', hoursPerUnit: 1.0, capacityHoursPerPeriod: 80 },  // Overloaded
        { code: 'WC-B', hoursPerUnit: 0.2, capacityHoursPerPeriod: 80 },  // Underloaded
      ],
    });

    expect(result[0].overloaded.every(v => v === true)).toBe(true);  // WC-A always over
    expect(result[1].overloaded.every(v => v === false)).toBe(true); // WC-B always under
  });
});

// ─── 5. Full Production Plan Run ────────────────────────────────

describe('Full Production Plan Run', () => {
  it('compares all three strategies and recommends best', () => {
    const result = runProductionPlan({
      periods: makePeriods(8),
      grossReqs: [100, 120, 90, 150, 130, 110, 100, 95],
      beginningInventory: 20,
      costPerUnit: 10,
      inventoryCarryingCost: 2,
      hiringCostPerUnit: 3,
      layoffCostPerUnit: 5,
      baseRate: 120,
      maxOvertimeRate: 40,
      overtimeCostPremium: 1.5,
      subcontractCostPremium: 2.0,
      workCenters: [
        { code: 'WC-ASSEMBLY', hoursPerUnit: 0.5, capacityHoursPerPeriod: 80 },
      ],
    });

    expect(result.strategies).toHaveProperty('chase');
    expect(result.strategies).toHaveProperty('level');
    expect(result.strategies).toHaveProperty('hybrid');
    expect(result.recommended).toBeDefined();
    expect(['chase', 'level', 'hybrid']).toContain(result.recommended);
  });

  it('includes RCCP validation for each strategy', () => {
    const result = runProductionPlan({
      periods: makePeriods(4),
      grossReqs: [100, 150, 80, 120],
      beginningInventory: 0,
      costPerUnit: 10,
      workCenters: [
        { code: 'WC-TEST', hoursPerUnit: 0.5, capacityHoursPerPeriod: 80 },
      ],
    });

    expect(result.strategies.chase.rccp).toBeDefined();
    expect(result.strategies.level.rccp).toBeDefined();
  });

  it('handles zero demand gracefully', () => {
    const result = runProductionPlan({
      periods: makePeriods(4),
      grossReqs: [0, 0, 0, 0],
      beginningInventory: 50,
      costPerUnit: 10,
    });

    expect(result.strategies.chase.production.every(p => p === 0)).toBe(true);
    expect(result.strategies.level.production.every(p => p === 0)).toBe(true);
  });
});
