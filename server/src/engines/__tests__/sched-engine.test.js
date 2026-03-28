/**
 * Production Scheduling Engine Tests — ASCM/APICS Compliance
 *
 * Written FIRST. Production Scheduling sits between Production Planning
 * and MRP in the ASCM MPC framework:
 *
 *   Demand Plan → DRP → Production Plan → Scheduling → MRP
 *
 * Scheduling takes the aggregate production plan and sequences specific
 * production orders on finite-capacity work centers:
 *   - Forward scheduling from earliest available time
 *   - Sequencing rules: SPT, EDD, Critical Ratio
 *   - Changeover time between different product types
 *   - Finite capacity constraints per work center
 */

import { describe, it, expect } from 'vitest';
import {
  forwardSchedule,
  sequenceOrders,
  calculateMakespan,
  runScheduler,
} from '../sched-engine.js';

// ─── Test Data Helpers ───────────────────────────────────────────

function makeOrders(specs) {
  return specs.map((s, i) => ({
    id: s.id || `ORD-${i + 1}`,
    skuCode: s.skuCode || 'MTR-100',
    qty: s.qty || 10,
    processingTime: s.processingTime, // hours
    dueDate: s.dueDate,
    priority: s.priority || 'normal',
    workCenter: s.workCenter || 'WC-ASSEMBLY',
  }));
}

// ─── 1. Forward Scheduling ──────────────────────────────────────

describe('Forward Scheduling', () => {
  it('schedules orders sequentially from start time', () => {
    const orders = makeOrders([
      { id: 'A', processingTime: 4, dueDate: '2026-04-10' },
      { id: 'B', processingTime: 3, dueDate: '2026-04-12' },
      { id: 'C', processingTime: 5, dueDate: '2026-04-15' },
    ]);

    const result = forwardSchedule({
      orders,
      startTime: 0,
      capacityHoursPerDay: 8,
    });

    expect(result).toHaveLength(3);
    // First order starts at time 0
    expect(result[0].startTime).toBe(0);
    // Second order starts after first finishes
    expect(result[1].startTime).toBe(4);
    // Third starts after second
    expect(result[2].startTime).toBe(7);
  });

  it('calculates end times correctly', () => {
    const orders = makeOrders([
      { id: 'A', processingTime: 4 },
      { id: 'B', processingTime: 6 },
    ]);

    const result = forwardSchedule({ orders, startTime: 0, capacityHoursPerDay: 8 });

    expect(result[0].endTime).toBe(4);
    expect(result[1].endTime).toBe(10);
  });

  it('accounts for changeover time between different SKUs', () => {
    const orders = makeOrders([
      { id: 'A', skuCode: 'MTR-100', processingTime: 4 },
      { id: 'B', skuCode: 'MTR-200', processingTime: 3 },  // Different SKU → changeover
      { id: 'C', skuCode: 'MTR-200', processingTime: 2 },  // Same SKU → no changeover
    ]);

    const result = forwardSchedule({
      orders,
      startTime: 0,
      capacityHoursPerDay: 8,
      changeoverTime: 1,
    });

    // A: 0-4, changeover 1hr, B: 5-8, no changeover, C: 8-10
    expect(result[1].startTime).toBe(5);  // 4 + 1 changeover
    expect(result[2].startTime).toBe(8);  // No changeover (same SKU)
  });

  it('flags late orders (end time past due date)', () => {
    const orders = makeOrders([
      { id: 'A', processingTime: 40, dueDate: '2026-04-08' },  // Takes 5 days at 8hr/day
    ]);

    const result = forwardSchedule({
      orders,
      startTime: 0,
      capacityHoursPerDay: 8,
    });

    expect(result[0].late).toBeDefined();
  });
});

// ─── 2. Sequencing Rules ────────────────────────────────────────

describe('Sequencing Rules', () => {
  const orders = makeOrders([
    { id: 'A', processingTime: 8, dueDate: '2026-04-15' },
    { id: 'B', processingTime: 3, dueDate: '2026-04-10' },
    { id: 'C', processingTime: 5, dueDate: '2026-04-20' },
    { id: 'D', processingTime: 2, dueDate: '2026-04-08' },
  ]);

  it('SPT: shortest processing time first', () => {
    const sequenced = sequenceOrders({ orders, rule: 'SPT' });
    // D(2) < B(3) < C(5) < A(8)
    expect(sequenced.map(o => o.id)).toEqual(['D', 'B', 'C', 'A']);
  });

  it('EDD: earliest due date first', () => {
    const sequenced = sequenceOrders({ orders, rule: 'EDD' });
    // D(4/8) < B(4/10) < A(4/15) < C(4/20)
    expect(sequenced.map(o => o.id)).toEqual(['D', 'B', 'A', 'C']);
  });

  it('CR: critical ratio (lowest first, most urgent)', () => {
    // CR = (due date - now) / processing time remaining
    // Lower CR = more urgent
    const sequenced = sequenceOrders({
      orders,
      rule: 'CR',
      currentDate: '2026-04-07',
    });

    // D: (1 day) / (2/8 days) = 4.0
    // B: (3 days) / (3/8 days) = 8.0
    // A: (8 days) / (8/8 days) = 8.0
    // C: (13 days) / (5/8 days) = 20.8
    // CR considers processing time as fraction of 8hr day
    // Sorted: D, A/B (tie by processing time), C
    expect(sequenced[0].id).toBe('D');
    expect(sequenced[sequenced.length - 1].id).toBe('C');
  });

  it('defaults to FIFO when rule is not recognized', () => {
    const sequenced = sequenceOrders({ orders, rule: 'UNKNOWN' });
    expect(sequenced.map(o => o.id)).toEqual(['A', 'B', 'C', 'D']);
  });
});

// ─── 3. Makespan Calculation ────────────────────────────────────

describe('Makespan Calculation', () => {
  it('calculates total time from first start to last end', () => {
    const schedule = [
      { startTime: 0, endTime: 4 },
      { startTime: 4, endTime: 7 },
      { startTime: 7, endTime: 12 },
    ];

    expect(calculateMakespan(schedule)).toBe(12);
  });

  it('returns 0 for empty schedule', () => {
    expect(calculateMakespan([])).toBe(0);
  });
});

// ─── 4. Full Scheduler Run ──────────────────────────────────────

describe('Full Scheduler Run', () => {
  it('sequences orders then forward schedules them', () => {
    const orders = makeOrders([
      { id: 'A', skuCode: 'MTR-100', processingTime: 8, dueDate: '2026-04-15', qty: 50 },
      { id: 'B', skuCode: 'MTR-200', processingTime: 4, dueDate: '2026-04-10', qty: 30 },
      { id: 'C', skuCode: 'MTR-100', processingTime: 6, dueDate: '2026-04-12', qty: 40 },
    ]);

    const result = runScheduler({
      orders,
      rule: 'EDD',
      capacityHoursPerDay: 8,
      changeoverTime: 1,
    });

    expect(result.schedule).toHaveLength(3);
    expect(result.makespan).toBeGreaterThan(0);
    expect(result.rule).toBe('EDD');
    // EDD order: B(4/10), C(4/12), A(4/15)
    expect(result.schedule[0].id).toBe('B');
  });

  it('compares multiple rules and shows best makespan', () => {
    const orders = makeOrders([
      { id: 'A', processingTime: 8, dueDate: '2026-04-15' },
      { id: 'B', processingTime: 3, dueDate: '2026-04-10' },
      { id: 'C', processingTime: 5, dueDate: '2026-04-12' },
    ]);

    const result = runScheduler({
      orders,
      rule: 'SPT',
      capacityHoursPerDay: 8,
      compareRules: true,
    });

    expect(result.comparison).toBeDefined();
    expect(result.comparison).toHaveProperty('SPT');
    expect(result.comparison).toHaveProperty('EDD');
    expect(result.comparison).toHaveProperty('CR');
  });

  it('returns Gantt-chart-friendly data', () => {
    const orders = makeOrders([
      { id: 'A', skuCode: 'MTR-100', processingTime: 4, dueDate: '2026-04-10', qty: 20 },
    ]);

    const result = runScheduler({
      orders,
      rule: 'EDD',
      capacityHoursPerDay: 8,
    });

    const item = result.schedule[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('skuCode');
    expect(item).toHaveProperty('startTime');
    expect(item).toHaveProperty('endTime');
    expect(item).toHaveProperty('processingTime');
    expect(item).toHaveProperty('dueDate');
  });
});
