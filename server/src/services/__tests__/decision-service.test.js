import { describe, it, expect } from 'vitest';
import {
  getDecisions,
  logDecision,
  getTrustScore,
  updateDecisionStatus,
  getDecisionById,
} from '../decision-service.js';

// The module pre-seeds ~22 decisions on import. Tests work with that baseline.

describe('getDecisions', () => {
  it('returns pre-seeded decisions', () => {
    const all = getDecisions();
    expect(all.length).toBeGreaterThan(0);
    // Each decision should have required fields
    const first = all[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('module');
    expect(first).toHaveProperty('action');
    expect(first).toHaveProperty('status');
  });

  it('filters by module', () => {
    const drpOnly = getDecisions({ module: 'drp' });
    expect(drpOnly.length).toBeGreaterThan(0);
    for (const d of drpOnly) {
      expect(d.module).toBe('drp');
    }
  });

  it('returns all when module is "all"', () => {
    const all = getDecisions({ module: 'all' });
    const unfiltered = getDecisions();
    expect(all.length).toBe(unfiltered.length);
  });

  it('respects limit parameter', () => {
    const limited = getDecisions({ limit: 3 });
    expect(limited).toHaveLength(3);
  });

  it('returns newest first', () => {
    const all = getDecisions();
    for (let i = 0; i < all.length - 1; i++) {
      expect(all[i].timestamp >= all[i + 1].timestamp).toBe(true);
    }
  });
});

describe('logDecision', () => {
  it('creates a new decision with auto-incrementing ID', () => {
    const before = getDecisions();
    const decision = logDecision({
      module: 'mrp',
      action: 'Test action',
      rationale: 'Testing decision log',
    });

    expect(decision.id).toMatch(/^DEC-\d{3,}$/);
    expect(decision.module).toBe('mrp');
    expect(decision.action).toBe('Test action');
    expect(decision.status).toBe('pending');
    expect(decision.timestamp).toBeDefined();

    const after = getDecisions();
    expect(after.length).toBe(before.length + 1);
  });

  it('assigns sequential IDs', () => {
    const d1 = logDecision({ module: 'drp', action: 'A1', rationale: 'r1' });
    const d2 = logDecision({ module: 'drp', action: 'A2', rationale: 'r2' });
    const num1 = parseInt(d1.id.replace('DEC-', ''), 10);
    const num2 = parseInt(d2.id.replace('DEC-', ''), 10);
    expect(num2).toBe(num1 + 1);
  });

  it('defaults decidedBy to "AI recommended"', () => {
    const d = logDecision({ module: 'demand', action: 'test', rationale: 'r' });
    expect(d.decidedBy).toBe('AI recommended');
  });

  it('uses provided status when given', () => {
    const d = logDecision({ module: 'demand', action: 'test', rationale: 'r', status: 'accepted' });
    expect(d.status).toBe('accepted');
  });
});

describe('updateDecisionStatus', () => {
  it('changes the status of an existing decision', () => {
    const d = logDecision({ module: 'mrp', action: 'status test', rationale: 'r' });
    expect(d.status).toBe('pending');

    const updated = updateDecisionStatus(d.id, 'accepted');
    expect(updated).not.toBeNull();
    expect(updated.status).toBe('accepted');
    expect(updated.updatedAt).toBeDefined();
  });

  it('returns null for non-existent ID', () => {
    const result = updateDecisionStatus('DEC-999999', 'accepted');
    expect(result).toBeNull();
  });

  it('persists the status change', () => {
    const d = logDecision({ module: 'mrp', action: 'persist test', rationale: 'r' });
    updateDecisionStatus(d.id, 'dismissed');

    const fetched = getDecisionById(d.id);
    expect(fetched.status).toBe('dismissed');
  });
});

describe('getTrustScore', () => {
  it('returns overall and perModule scores', () => {
    const score = getTrustScore();
    expect(score).toHaveProperty('overall');
    expect(score).toHaveProperty('perModule');
    expect(score.overall).toHaveProperty('total');
    expect(score.overall).toHaveProperty('accepted');
    expect(score.overall).toHaveProperty('trustPct');
    expect(typeof score.overall.trustPct).toBe('number');
  });

  it('computes correct percentages for a single module', () => {
    const score = getTrustScore({ module: 'drp' });
    expect(score).toHaveProperty('module', 'drp');
    expect(score).toHaveProperty('trustPct');
    expect(score).toHaveProperty('overall');
    // trustPct should be between 0 and 100
    expect(score.trustPct).toBeGreaterThanOrEqual(0);
    expect(score.trustPct).toBeLessThanOrEqual(100);
    // Verify trustPct = round(accepted/total * 100)
    if (score.total > 0) {
      const expected = Math.round((score.accepted / score.total) * 100);
      expect(score.trustPct).toBe(expected);
    }
  });

  it('returns all modules when module is "all"', () => {
    const score = getTrustScore({ module: 'all' });
    expect(score).toHaveProperty('overall');
    expect(score).toHaveProperty('perModule');
  });

  it('includes all five planning modules', () => {
    const score = getTrustScore();
    const modules = Object.keys(score.perModule);
    expect(modules).toContain('demand');
    expect(modules).toContain('drp');
    expect(modules).toContain('production');
    expect(modules).toContain('scheduling');
    expect(modules).toContain('mrp');
  });
});
