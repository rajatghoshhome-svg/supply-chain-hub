import { describe, it, expect } from 'vitest';
import {
  calculateFinancialImpact,
  calculateExceptionImpact,
  attachFinancialImpacts,
  compareScenarios,
} from '../financial-impact.js';

describe('calculateFinancialImpact', () => {
  it('computes totals from a full scenario result', () => {
    const result = calculateFinancialImpact({
      drp: { critical: 2, skusPlanned: 10, exceptions: 5 },
      production: {},
      scheduling: { lateOrders: 3, orders: 50 },
      mrp: { critical: 4, totalExceptions: 8 },
    });

    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.revenueAtRisk).toBeGreaterThan(0);
    expect(result.cashImpact).toBeGreaterThan(0);
    expect(result.serviceLevel).toBeGreaterThanOrEqual(0);
    expect(result.serviceLevel).toBeLessThanOrEqual(100);
    expect(result.planExceptions).toBe(13); // 8 + 5
    expect(result.lateOrders).toBe(3);
    expect(result.breakdown).toHaveProperty('expediteCost');
    expect(result.breakdown).toHaveProperty('stockoutRisk');
    expect(result.breakdown).toHaveProperty('inventoryCarrying');
    expect(result.breakdown).toHaveProperty('overtimeCost');
    expect(result.breakdown).toHaveProperty('lateOrderPenalties');
  });

  it('handles missing/null module results gracefully', () => {
    const result = calculateFinancialImpact({});
    expect(result.totalCost).toBe(0);
    expect(result.revenueAtRisk).toBe(0);
    expect(result.planExceptions).toBe(0);
    expect(result.lateOrders).toBe(0);
    expect(result.serviceLevel).toBe(100);
  });

  it('accepts custom cost overrides', () => {
    const customCosts = {
      expeditePerUnit: 100,
      stockoutPerUnit: 200,
      inventoryCarryPerUnit: 10,
      overtimePerHour: 100,
      lateOrderPenalty: 1000,
      changeoverCost: 500,
    };
    const result = calculateFinancialImpact({
      mrp: { critical: 1, totalExceptions: 1 },
      drp: { critical: 1, skusPlanned: 1, exceptions: 1 },
      scheduling: { lateOrders: 1, orders: 10 },
    }, customCosts);

    expect(result.breakdown.expediteCost).toBe(100 * 100); // 1 critical * 100/unit * 100
    expect(result.breakdown.lateOrderPenalties).toBe(1000); // 1 * 1000
  });
});

describe('calculateExceptionImpact', () => {
  it('calculates expedite exception cost', () => {
    const impact = calculateExceptionImpact({ type: 'expedite', qty: 50 });
    expect(impact.amount).toBe(750); // 50 * 15
    expect(impact.type).toBe('cost');
    expect(impact.formatted).toContain('$');
  });

  it('calculates stockout exception cost', () => {
    const impact = calculateExceptionImpact({ type: 'stockout', qty: 10 });
    expect(impact.amount).toBe(850); // 10 * 85
    expect(impact.type).toBe('risk');
  });

  it('calculates safety-stock exception cost', () => {
    const impact = calculateExceptionImpact({ type: 'safety-stock-violation', qty: 20 });
    expect(impact.amount).toBe(1700); // 20 * 85
    expect(impact.type).toBe('risk');
  });

  it('calculates reschedule-in cost', () => {
    const impact = calculateExceptionImpact({ type: 'reschedule-in', qty: 100 });
    expect(impact.amount).toBe(750); // 100 * 7.5
    expect(impact.type).toBe('cost');
  });

  it('calculates reschedule-out cost avoidance', () => {
    const impact = calculateExceptionImpact({ type: 'reschedule-out', qty: 100 });
    expect(impact.amount).toBe(250); // 100 * 2.5
    expect(impact.type).toBe('cost-avoidance');
  });

  it('calculates capacity/overload exception cost', () => {
    const impact = calculateExceptionImpact({ type: 'capacity-overload', hours: 4 });
    expect(impact.amount).toBe(180); // 4 * 45
    expect(impact.type).toBe('cost');
  });

  it('calculates cancel exception savings', () => {
    const impact = calculateExceptionImpact({ type: 'cancel', qty: 200 });
    expect(impact.amount).toBe(1500); // 200 * 7.5
    expect(impact.type).toBe('savings');
  });

  it('handles unknown exception types with generic cost', () => {
    const impact = calculateExceptionImpact({ type: 'something-new', qty: 50 });
    expect(impact.amount).toBe(500); // 50 * 10
    expect(impact.type).toBe('cost');
  });

  it('uses fallback qty of 100 when qty is missing', () => {
    const impact = calculateExceptionImpact({ type: 'expedite' });
    expect(impact.amount).toBe(1500); // 100 * 15
  });

  it('uses affectedQty when qty is not present', () => {
    const impact = calculateExceptionImpact({ type: 'expedite', affectedQty: 30 });
    expect(impact.amount).toBe(450); // 30 * 15
  });
});

describe('attachFinancialImpacts', () => {
  it('attaches financialImpact to every exception in array', () => {
    const exceptions = [
      { type: 'expedite', qty: 10 },
      { type: 'stockout', qty: 5 },
    ];
    const result = attachFinancialImpacts(exceptions);
    expect(result).toHaveLength(2);
    expect(result[0].financialImpact.amount).toBe(150);
    expect(result[1].financialImpact.amount).toBe(425);
    // Preserves original fields
    expect(result[0].type).toBe('expedite');
  });

  it('handles empty array', () => {
    expect(attachFinancialImpacts([])).toEqual([]);
  });
});

describe('compareScenarios', () => {
  it('returns financial summary for each scenario', () => {
    const scenarios = [
      { label: 'Base', multiplier: 1.0, drp: { critical: 1, skusPlanned: 5, exceptions: 2 }, mrp: { critical: 1, totalExceptions: 3 }, scheduling: { lateOrders: 0, orders: 10 } },
      { label: '+20%', multiplier: 1.2, drp: { critical: 3, skusPlanned: 5, exceptions: 6 }, mrp: { critical: 2, totalExceptions: 7 }, scheduling: { lateOrders: 2, orders: 10 } },
    ];
    const result = compareScenarios(scenarios);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Base');
    expect(result[1].label).toBe('+20%');
    expect(result[1].totalCost).toBeGreaterThan(result[0].totalCost);
    expect(result[0]).toHaveProperty('serviceLevel');
    expect(result[0]).toHaveProperty('breakdown');
  });
});
