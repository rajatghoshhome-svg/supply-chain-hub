import { describe, it, expect } from 'vitest';
import { validateRecord, validateBatch, applyFixes, rules } from '../data-health.js';

describe('Self-Healing Data Validation', () => {
  describe('Lead Time Rules', () => {
    it('auto-fixes negative lead time to 0', () => {
      const result = validateRecord({ leadTimeDays: -5 });
      expect(result.autoFixed).toHaveLength(1);
      expect(result.autoFixed[0].fix.leadTimeDays).toBe(0);
    });

    it('flags unusually long lead time', () => {
      const result = validateRecord({ leadTimeDays: 400 });
      expect(result.flagged).toHaveLength(1);
      expect(result.flagged[0].field).toBe('lead_time_days');
    });

    it('passes valid lead time', () => {
      const result = validateRecord({ leadTimeDays: 14 });
      expect(result.autoFixed).toHaveLength(0);
      expect(result.flagged).toHaveLength(0);
    });
  });

  describe('Safety Stock Rules', () => {
    it('auto-fixes negative safety stock', () => {
      const result = validateRecord({ safetyStock: -10 });
      expect(result.autoFixed).toHaveLength(1);
      expect(result.autoFixed[0].fix.safetyStock).toBe(0);
    });
  });

  describe('BOM Rules', () => {
    it('blocks zero quantity per', () => {
      const result = validateRecord({ quantityPer: 0 });
      expect(result.blocked).toHaveLength(1);
    });

    it('blocks negative quantity per', () => {
      const result = validateRecord({ quantityPer: -1 });
      expect(result.blocked).toHaveLength(1);
    });
  });

  describe('Scrap % Rules', () => {
    it('auto-fixes negative scrap', () => {
      const result = validateRecord({ scrapPct: -5 });
      expect(result.autoFixed).toHaveLength(1);
      expect(result.autoFixed[0].fix.scrapPct).toBe(0);
    });

    it('blocks scrap >= 100%', () => {
      const result = validateRecord({ scrapPct: 100 });
      expect(result.blocked).toHaveLength(1);
    });

    it('flags high scrap > 50%', () => {
      const result = validateRecord({ scrapPct: 75 });
      expect(result.flagged).toHaveLength(1);
    });

    it('passes normal scrap %', () => {
      const result = validateRecord({ scrapPct: 8 });
      expect(result.blocked).toHaveLength(0);
      expect(result.flagged).toHaveLength(0);
    });
  });

  describe('Demand Rules', () => {
    it('auto-fixes negative demand', () => {
      const result = validateRecord({ demandQty: -100 });
      expect(result.autoFixed).toHaveLength(1);
      expect(result.autoFixed[0].fix.demandQty).toBe(0);
    });
  });

  describe('Lot Size Rules', () => {
    it('blocks FOQ without value', () => {
      const result = validateRecord({ lotSizeRule: 'fixed-order-qty', lotSizeValue: 0 });
      expect(result.blocked).toHaveLength(1);
    });

    it('passes L4L without value', () => {
      const result = validateRecord({ lotSizeRule: 'lot-for-lot', lotSizeValue: 0 });
      expect(result.blocked).toHaveLength(0);
    });
  });

  describe('On-Hand Reasonableness', () => {
    it('flags excessive weeks of supply', () => {
      const result = validateRecord({ onHand: 10000, avgDemand: 10 });
      expect(result.flagged).toHaveLength(1);
      expect(result.flagged[0].message).toContain('weeks of supply');
    });
  });

  describe('Forecast Confidence', () => {
    it('auto-fixes confidence > 100', () => {
      const result = validateRecord({ confidence: 150 });
      expect(result.autoFixed).toHaveLength(1);
      expect(result.autoFixed[0].fix.confidence).toBe(100);
    });

    it('auto-fixes negative confidence', () => {
      const result = validateRecord({ confidence: -10 });
      expect(result.autoFixed).toHaveLength(1);
      expect(result.autoFixed[0].fix.confidence).toBe(0);
    });
  });
});

describe('Batch Validation', () => {
  it('validates multiple records and aggregates results', () => {
    const records = [
      { leadTimeDays: -5, safetyStock: 10 },   // 1 auto-fix
      { leadTimeDays: 14, quantityPer: 0 },     // 1 block
      { leadTimeDays: 400, scrapPct: 8 },       // 1 flag
    ];

    const result = validateBatch(records);
    expect(result.summary.totalRecords).toBe(3);
    expect(result.summary.autoFixed).toBe(1);
    expect(result.summary.blocked).toBe(1);
    expect(result.summary.flagged).toBe(1);
  });

  it('includes row indices in findings', () => {
    const records = [
      { leadTimeDays: 10 },
      { leadTimeDays: -3 },
    ];

    const result = validateBatch(records);
    expect(result.autoFixed[0].rowIndex).toBe(1);
  });
});

describe('applyFixes', () => {
  it('applies auto-fix values to record', () => {
    const record = { leadTimeDays: -5, name: 'Test' };
    const fixes = [{ fix: { leadTimeDays: 0 } }];
    const fixed = applyFixes(record, fixes);

    expect(fixed.leadTimeDays).toBe(0);
    expect(fixed.name).toBe('Test');
  });

  it('applies multiple fixes', () => {
    const record = { safetyStock: -10, scrapPct: -5 };
    const fixes = [
      { fix: { safetyStock: 0 } },
      { fix: { scrapPct: 0 } },
    ];
    const fixed = applyFixes(record, fixes);

    expect(fixed.safetyStock).toBe(0);
    expect(fixed.scrapPct).toBe(0);
  });

  it('skips entries without fix field', () => {
    const record = { name: 'Test' };
    const fixes = [{ message: 'flagged', confidence: 50 }];
    const fixed = applyFixes(record, fixes);

    expect(fixed).toEqual({ name: 'Test' });
  });
});

describe('Selective Rule Running', () => {
  it('runs only specified rules', () => {
    const record = { leadTimeDays: -5, scrapPct: -3 };
    const result = validateRecord(record, ['leadTimePositive']);

    // Only lead time rule should have run
    expect(result.autoFixed).toHaveLength(1);
    expect(result.autoFixed[0].rule).toBe('leadTimePositive');
  });
});
