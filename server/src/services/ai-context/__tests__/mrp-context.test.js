/**
 * MRP Context Builder Tests
 *
 * Verifies that the AI context builder produces correct prompt structure
 * from MRP engine output. No API calls — tests the prompt construction only.
 */

import { describe, it, expect } from 'vitest';
import { buildMRPContext, formatMRPSummary } from '../mrp-context.js';

const PERIODS = ['2026-04-07', '2026-04-14', '2026-04-21', '2026-04-28'];

function makeMRPResult({ code, name, records, exceptions }) {
  return {
    sku: { id: 1, code, name },
    records: records.map((r, i) => ({
      period: PERIODS[i],
      grossReq: r.grossReq || 0,
      scheduledReceipts: r.scheduledReceipts || 0,
      projectedOH: r.projectedOH || 0,
      netReq: r.netReq || 0,
      plannedOrderReceipt: r.plannedOrderReceipt || 0,
      plannedOrderRelease: r.plannedOrderRelease || 0,
    })),
    exceptions: exceptions || [],
  };
}

// ─── Context Structure ────────────────────────────────────────────

describe('buildMRPContext', () => {
  it('returns systemPrompt and userMessage', () => {
    const { systemPrompt, userMessage } = buildMRPContext({
      mrpResults: [],
      bomTree: {},
      periods: PERIODS,
    });

    expect(systemPrompt).toContain('ASCM/APICS');
    expect(userMessage).toContain('MRP Run Results');
  });

  it('includes planning horizon in header', () => {
    const { userMessage } = buildMRPContext({
      mrpResults: [],
      bomTree: {},
      periods: PERIODS,
    });

    expect(userMessage).toContain('2026-04-07');
    expect(userMessage).toContain('2026-04-28');
    expect(userMessage).toContain('4 weekly periods');
  });

  it('includes exception summary counts', () => {
    const mrpResults = [
      makeMRPResult({
        code: 'SKU-A', name: 'Test A',
        records: [{ grossReq: 10 }, { grossReq: 20 }, { grossReq: 30 }, { grossReq: 10 }],
        exceptions: [
          { type: 'expedite', skuCode: 'SKU-A', severity: 'critical', period: '2026-04-07', qty: 50, message: 'Expedite needed' },
          { type: 'reschedule-out', skuCode: 'SKU-A', severity: 'info', fromPeriod: '2026-04-07', qty: 20, message: 'Reschedule out' },
        ],
      }),
    ];

    const { userMessage } = buildMRPContext({
      mrpResults,
      bomTree: {},
      periods: PERIODS,
    });

    expect(userMessage).toContain('**Critical:** 1');
    expect(userMessage).toContain('**Info:** 1');
  });

  it('includes exception details table', () => {
    const mrpResults = [
      makeMRPResult({
        code: 'MTR-100', name: 'Motor 100',
        records: [{ grossReq: 10 }, { grossReq: 10 }, { grossReq: 10 }, { grossReq: 10 }],
        exceptions: [
          { type: 'cancel', skuCode: 'MTR-100', severity: 'warning', period: '2026-04-14', qty: 30, message: 'Cancel order of 30' },
        ],
      }),
    ];

    const { userMessage } = buildMRPContext({
      mrpResults,
      bomTree: {},
      periods: PERIODS,
    });

    expect(userMessage).toContain('| MTR-100 | cancel | warning | 2026-04-14 | 30 |');
  });

  it('includes shortage analysis when net requirements exist', () => {
    const mrpResults = [
      makeMRPResult({
        code: 'CU-WIRE', name: 'Copper Wire',
        records: [
          { grossReq: 0, netReq: 0, projectedOH: 100 },
          { grossReq: 80, netReq: 0, projectedOH: 20 },
          { grossReq: 50, netReq: 30, projectedOH: -30 },
          { grossReq: 40, netReq: 40, projectedOH: -70 },
        ],
        exceptions: [],
      }),
    ];

    const { userMessage } = buildMRPContext({
      mrpResults,
      bomTree: {},
      periods: PERIODS,
    });

    expect(userMessage).toContain('Material Shortages');
    expect(userMessage).toContain('CU-WIRE');
    expect(userMessage).toContain('Copper Wire');
  });

  it('includes BOM structure for cascade analysis', () => {
    const bomTree = {
      'MTR-100': [
        { childCode: 'STAT-A', qtyPer: 1, scrapPct: 0 },
        { childCode: 'ROT-A', qtyPer: 1, scrapPct: 0 },
      ],
      'STAT-A': [
        { childCode: 'LAM-STEEL', qtyPer: 2.5, scrapPct: 8 },
      ],
    };

    const { userMessage } = buildMRPContext({
      mrpResults: [],
      bomTree,
      periods: PERIODS,
    });

    expect(userMessage).toContain('BOM Structure');
    expect(userMessage).toContain('MTR-100');
    expect(userMessage).toContain('STAT-A (×1)');
    expect(userMessage).toContain('LAM-STEEL (×2.5, 8% scrap)');
  });

  it('includes planned order releases table', () => {
    const mrpResults = [
      makeMRPResult({
        code: 'BEAR-6205', name: 'Bearing 6205',
        records: [
          { plannedOrderRelease: 50 },
          { plannedOrderRelease: 0 },
          { plannedOrderRelease: 50 },
          { plannedOrderRelease: 0 },
        ],
        exceptions: [],
      }),
    ];

    const { userMessage } = buildMRPContext({
      mrpResults,
      bomTree: {},
      periods: PERIODS,
    });

    expect(userMessage).toContain('Planned Order Releases');
    expect(userMessage).toContain('BEAR-6205');
    expect(userMessage).toContain('50');
  });

  it('appends default analysis task when no planner question', () => {
    const { userMessage } = buildMRPContext({
      mrpResults: [],
      bomTree: {},
      periods: PERIODS,
    });

    expect(userMessage).toContain('Analyze these MRP results');
  });

  it('appends planner question when provided', () => {
    const { userMessage } = buildMRPContext({
      mrpResults: [],
      bomTree: {},
      periods: PERIODS,
      plannerQuestion: 'Should I expedite the copper wire order?',
    });

    expect(userMessage).toContain('Planner Question');
    expect(userMessage).toContain('Should I expedite the copper wire order?');
    expect(userMessage).not.toContain('Analyze these MRP results');
  });
});

// ─── System Prompt Quality ────────────────────────────────────────

describe('System Prompt', () => {
  it('contains ASCM/APICS reference', () => {
    const { systemPrompt } = buildMRPContext({
      mrpResults: [], bomTree: {}, periods: PERIODS,
    });
    expect(systemPrompt).toContain('ASCM/APICS');
  });

  it('instructs AI to cite specific data', () => {
    const { systemPrompt } = buildMRPContext({
      mrpResults: [], bomTree: {}, periods: PERIODS,
    });
    expect(systemPrompt).toContain('cite specific SKU codes');
  });

  it('instructs AI not to fabricate data', () => {
    const { systemPrompt } = buildMRPContext({
      mrpResults: [], bomTree: {}, periods: PERIODS,
    });
    expect(systemPrompt).toContain('NEVER fabricate data');
  });

  it('targets SMB manufacturers', () => {
    const { systemPrompt } = buildMRPContext({
      mrpResults: [], bomTree: {}, periods: PERIODS,
    });
    expect(systemPrompt).toContain('$50M-$500M');
  });
});

// ─── Format Summary ───────────────────────────────────────────────

describe('formatMRPSummary', () => {
  it('aggregates totals correctly', () => {
    const mrpResults = [
      makeMRPResult({
        code: 'SKU-A', name: 'Test A',
        records: [
          { netReq: 10, plannedOrderReceipt: 10 },
          { netReq: 0, plannedOrderReceipt: 0 },
          { netReq: 20, plannedOrderReceipt: 20 },
          { netReq: 0, plannedOrderReceipt: 0 },
        ],
        exceptions: [
          { type: 'expedite', severity: 'critical' },
          { type: 'cancel', severity: 'warning' },
        ],
      }),
    ];

    const summary = formatMRPSummary(mrpResults);
    expect(summary[0].totalNetReq).toBe(30);
    expect(summary[0].totalPlannedOrders).toBe(30);
    expect(summary[0].exceptionCount).toBe(2);
    expect(summary[0].criticalExceptions).toBe(1);
  });
});
