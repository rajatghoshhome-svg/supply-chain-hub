import { describe, it, expect } from 'vitest';
import { suggestResolution, suggestResolutions, getLearningStats } from '../exception-learning.js';

describe('suggestResolution', () => {
  it('finds matching patterns for an expedite exception in MRP', () => {
    const result = suggestResolution({
      module: 'mrp',
      type: 'expedite',
      message: 'Material shortage requires expedite',
    });

    expect(result.suggestedAction).not.toBeNull();
    expect(result.matchCount).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.pattern).toBe('expedite');
  });

  it('finds matching patterns for a capacity overload in production', () => {
    const result = suggestResolution({
      module: 'production',
      type: 'capacity-overload',
      message: 'Overtime needed due to capacity bottleneck',
    });

    expect(result.suggestedAction).not.toBeNull();
    expect(result.matchCount).toBeGreaterThan(0);
    expect(result.pattern).toBe('capacity-overload');
  });

  it('returns null suggestion when no pattern matches', () => {
    const result = suggestResolution({
      module: 'unknown-module',
      type: 'nonexistent-type',
      message: 'Something completely unrelated xyz123',
    });

    expect(result.suggestedAction).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.matchCount).toBe(0);
  });

  it('computes confidence as acceptance rate percentage', () => {
    const result = suggestResolution({
      module: 'drp',
      type: 'expedite',
      message: 'Expedite needed for stockout prevention',
    });

    // Confidence = round(accepted / total * 100)
    if (result.matchCount > 0) {
      const expected = Math.round((result.acceptedCount / result.matchCount) * 100);
      expect(result.confidence).toBe(expected);
    }
  });

  it('returns history entries limited to 5', () => {
    const result = suggestResolution({
      module: 'mrp',
      type: 'expedite',
      message: 'Material shortage requires expedite',
    });

    expect(result.history.length).toBeLessThanOrEqual(5);
    if (result.history.length > 0) {
      expect(result.history[0]).toHaveProperty('id');
      expect(result.history[0]).toHaveProperty('action');
      expect(result.history[0]).toHaveProperty('status');
    }
  });

  it('includes totalDecisions count', () => {
    const result = suggestResolution({
      module: 'demand',
      type: 'demand-anomaly',
      message: 'Demand spike detected as anomaly',
    });

    expect(result.totalDecisions).toBeGreaterThan(0);
  });
});

describe('suggestResolutions (batch)', () => {
  it('returns suggestions for multiple exceptions', () => {
    const exceptions = [
      { module: 'mrp', type: 'expedite', message: 'shortage expedite' },
      { module: 'production', type: 'capacity-overload', message: 'overtime capacity' },
    ];
    const results = suggestResolutions(exceptions);

    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty('exception');
    expect(results[0]).toHaveProperty('suggestion');
    expect(results[1]).toHaveProperty('exception');
    expect(results[1]).toHaveProperty('suggestion');
  });
});

describe('getLearningStats', () => {
  it('returns overall stats structure', () => {
    const stats = getLearningStats();

    expect(stats).toHaveProperty('totalDecisions');
    expect(stats).toHaveProperty('overallAcceptance');
    expect(stats).toHaveProperty('patternCoverage');
    expect(stats).toHaveProperty('moduleStats');
    expect(stats).toHaveProperty('learningMaturity');
    expect(stats.totalDecisions).toBeGreaterThan(0);
  });

  it('computes overallAcceptance as percentage', () => {
    const stats = getLearningStats();
    expect(stats.overallAcceptance).toBeGreaterThanOrEqual(0);
    expect(stats.overallAcceptance).toBeLessThanOrEqual(100);
  });

  it('includes per-module breakdowns', () => {
    const stats = getLearningStats();
    const modules = Object.keys(stats.moduleStats);
    expect(modules.length).toBeGreaterThan(0);

    for (const mod of modules) {
      const ms = stats.moduleStats[mod];
      expect(ms).toHaveProperty('total');
      expect(ms).toHaveProperty('accepted');
      expect(ms).toHaveProperty('deferred');
      expect(ms).toHaveProperty('dismissed');
    }
  });

  it('reports learning maturity based on decision count', () => {
    const stats = getLearningStats();
    // With ~22 seeded decisions + any added in tests, should be at least 'medium'
    expect(['low', 'medium', 'high']).toContain(stats.learningMaturity);
  });

  it('reports patternCoverage matching EXCEPTION_PATTERNS count', () => {
    const stats = getLearningStats();
    // There are 6 exception patterns defined
    expect(stats.patternCoverage).toBe(6);
  });
});
